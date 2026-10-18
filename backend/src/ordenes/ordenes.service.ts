import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { UsuarioActual } from '../common/decorators/auth.decorators';
import { Rol } from '../common/enums/rol.enum';
import { tallerDe } from '../common/utils/taller.util';
import { EVENTOS, OrdenEstadoCambiadoEvent } from '../reglas/eventos';
import { TipoMovimiento } from '../repuestos/movimiento.entity';
import { Repuesto } from '../repuestos/repuesto.entity';
import { RepuestosService } from '../repuestos/repuestos.service';
import { Usuario } from '../usuarios/usuario.entity';
import { Vehiculo } from '../vehiculos/vehiculo.entity';
import {
  AgregarRepuestoDto,
  AsignarMecanicoDto,
  CambiarEstadoDto,
  CreateOrdenDto,
  FiltroOrdenesDto,
  UpdateOrdenDto,
} from './dto/orden.dto';
import { HistorialEstado } from './historial-estado.entity';
import {
  ESTADOS_ABIERTOS,
  ESTADOS_CON_REPUESTOS,
  EstadoOrden,
  validarTransicion,
} from './maquina-estados';
import { OrdenRepuesto } from './orden-repuesto.entity';
import { OrdenTrabajo } from './orden.entity';

export const formatoNumero = (n: number) => `OT-${String(n).padStart(4, '0')}`;

@Injectable()
export class OrdenesService {
  constructor(
    @InjectRepository(OrdenTrabajo) private readonly repo: Repository<OrdenTrabajo>,
    private readonly dataSource: DataSource,
    private readonly repuestos: RepuestosService,
    private readonly eventos: EventEmitter2,
  ) {}

  // ---------------------------------------------------------------- consultas

  listar(user: UsuarioActual, f: FiltroOrdenesDto) {
    const qb = this.repo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.vehiculo', 'v')
      .leftJoinAndSelect('o.cliente', 'c')
      .leftJoinAndSelect('o.mecanico', 'm')
      .leftJoinAndSelect('o.repuestos', 'r')
      .leftJoinAndSelect('r.repuesto', 'rp')
      .where('o.taller_id = :tallerId', { tallerId: tallerDe(user) })
      // Con take() + joins TypeORM exige el nombre de la propiedad, no de la columna.
      .orderBy('o.fechaIngreso', 'DESC');

    if (f.estado) qb.andWhere('o.estado = :estado', { estado: f.estado });
    if (f.abiertas) qb.andWhere('o.estado IN (:...abiertos)', { abiertos: ESTADOS_ABIERTOS });
    if (f.vehiculoId) qb.andWhere('o.vehiculo_id = :vehiculoId', { vehiculoId: f.vehiculoId });
    if (f.q?.trim()) {
      const q = f.q.trim();
      const numero = Number(q.replace(/\D/g, ''));
      qb.andWhere(
        `(v.placa ILIKE :placa OR c.nombre ILIKE :q ${numero ? 'OR o.numero = :numero' : ''})`,
        { placa: `%${q.toUpperCase().replace(/[\s-]/g, '')}%`, q: `%${q}%`, numero },
      );
    }
    if (!f.abiertas) qb.take(100);
    return qb.getMany();
  }

  async obtener(user: UsuarioActual, id: string) {
    const orden = await this.repo.findOne({
      where: { id, tallerId: tallerDe(user) },
      relations: {
        vehiculo: true,
        cliente: true,
        mecanico: true,
        repuestos: { repuesto: true },
        historial: { usuario: true },
      },
      order: { repuestos: { createdAt: 'ASC' }, historial: { fecha: 'ASC' } },
    });
    if (!orden) throw new NotFoundException('Orden de trabajo no encontrada');
    return orden;
  }

  /** Cantidad de órdenes abiertas por estado (pantalla de inicio). */
  async resumen(user: UsuarioActual) {
    const filas: { estado: EstadoOrden; total: string }[] = await this.repo
      .createQueryBuilder('o')
      .select('o.estado', 'estado')
      .addSelect('COUNT(*)', 'total')
      .where('o.taller_id = :tallerId', { tallerId: tallerDe(user) })
      .andWhere('o.estado IN (:...abiertos)', { abiertos: ESTADOS_ABIERTOS })
      .groupBy('o.estado')
      .getRawMany();

    return Object.fromEntries(ESTADOS_ABIERTOS.map((e) => [e, Number(filas.find((f) => f.estado === e)?.total ?? 0)]));
  }

  // ---------------------------------------------------------------- creación

  /** HU-09: registrar la OT al recibir el vehículo. */
  async crear(user: UsuarioActual, dto: CreateOrdenDto) {
    const tallerId = tallerDe(user);

    const id = await this.dataSource.transaction(async (m) => {
      if (dto.id && (await m.exists(OrdenTrabajo, { where: { id: dto.id } }))) {
        throw new ConflictException('La orden ya fue registrada');
      }

      // Bloquea el vehículo para que dos recepciones simultáneas no creen dos OT.
      const vehiculo = await m.findOne(Vehiculo, {
        where: { id: dto.vehiculoId, tallerId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!vehiculo) throw new BadRequestException('El vehículo no existe');

      // RN-06: un vehículo solo puede tener una OT abierta.
      const abierta = await m.findOne(OrdenTrabajo, {
        where: { vehiculoId: vehiculo.id, estado: In(ESTADOS_ABIERTOS) },
      });
      if (abierta) {
        throw new ConflictException(
          `El vehículo ${vehiculo.placa} ya tiene la orden ${formatoNumero(abierta.numero)} abierta`,
        );
      }

      // RN-07: el kilometraje no retrocede; la OT actualiza el del vehículo.
      if (dto.kilometrajeIngreso < vehiculo.kilometraje) {
        throw new BadRequestException(
          `El kilometraje no puede ser menor al último registrado (${vehiculo.kilometraje} km)`,
        );
      }
      await m.update(Vehiculo, vehiculo.id, { kilometraje: dto.kilometrajeIngreso });

      if (dto.mecanicoId) await this.verificarMecanico(m, tallerId, dto.mecanicoId);

      const fechaIngreso = fechaValida(dto.fechaIngreso);
      const orden = m.create(OrdenTrabajo, {
        id: dto.id ?? randomUUID(),
        tallerId,
        numero: await this.siguienteNumero(m, tallerId),
        vehiculoId: vehiculo.id,
        clienteId: vehiculo.clienteId,
        mecanicoId: dto.mecanicoId ?? null,
        creadoPorId: user.id,
        estado: EstadoOrden.RECIBIDO,
        problemaReportado: dto.problemaReportado,
        observacionesRecepcion: dto.observacionesRecepcion ?? null,
        kilometrajeIngreso: dto.kilometrajeIngreso,
        fechaIngreso,
      });
      await m.insert(OrdenTrabajo, orden);
      await m.insert(HistorialEstado, {
        ordenId: orden.id,
        estadoAnterior: null,
        estadoNuevo: EstadoOrden.RECIBIDO,
        usuarioId: user.id,
        comentario: 'Vehículo recibido',
        fecha: fechaIngreso,
      });
      return orden.id;
    });

    return this.obtener(user, id);
  }

  // ---------------------------------------------------------------- edición

  async actualizar(user: UsuarioActual, id: string, dto: UpdateOrdenDto) {
    await this.dataSource.transaction(async (m) => {
      const orden = await this.bloquear(m, user, id);
      this.verificarPermiso(user, orden);

      const editables = [EstadoOrden.RECIBIDO, ...ESTADOS_CON_REPUESTOS];
      if (!editables.includes(orden.estado)) {
        throw new BadRequestException('La orden ya no se puede modificar en estado ' + orden.estado);
      }
      if (dto.sinRepuestos !== undefined && !ESTADOS_CON_REPUESTOS.includes(orden.estado)) {
        throw new BadRequestException('Primero inicie el diagnóstico');
      }
      if (dto.sinRepuestos) {
        const usados = await m.count(OrdenRepuesto, { where: { ordenId: id } });
        if (usados > 0) throw new BadRequestException('La orden ya tiene repuestos registrados');
      }
      if (Object.keys(dto).length > 0) await m.update(OrdenTrabajo, id, { ...dto });
    });
    return this.obtener(user, id);
  }

  /** HU-11: asignar mecánico (solo ADMIN). */
  async asignarMecanico(user: UsuarioActual, id: string, dto: AsignarMecanicoDto) {
    await this.dataSource.transaction(async (m) => {
      const orden = await this.bloquear(m, user, id);
      if (!ESTADOS_ABIERTOS.includes(orden.estado)) {
        throw new BadRequestException('La orden está cerrada');
      }
      if (!dto.mecanicoId && orden.estado !== EstadoOrden.RECIBIDO) {
        throw new BadRequestException('Una orden en curso debe tener un mecánico asignado');
      }
      if (dto.mecanicoId) await this.verificarMecanico(m, orden.tallerId, dto.mecanicoId);
      await m.update(OrdenTrabajo, id, { mecanicoId: dto.mecanicoId ?? null });
    });
    return this.obtener(user, id);
  }

  /** HU-10: avanzar la OT según la máquina de estados. */
  async cambiarEstado(user: UsuarioActual, id: string, dto: CambiarEstadoDto) {
    let evento: OrdenEstadoCambiadoEvent | null = null;
    let repuestosDevueltos: string[] = [];

    await this.dataSource.transaction(async (m) => {
      const orden = await this.bloquear(m, user, id);
      this.verificarPermiso(user, orden);

      // Si un mecánico toma una OT sin asignar, queda asignada a él.
      if (
        dto.estado === EstadoOrden.EN_DIAGNOSTICO &&
        !orden.mecanicoId &&
        user.rol === Rol.MECANICO
      ) {
        orden.mecanicoId = user.id;
      }

      const lineas = await m.find(OrdenRepuesto, { where: { ordenId: id } });
      const error = validarTransicion(
        { ...orden, totalRepuestos: lineas.length },
        dto.estado,
        dto.comentario,
      );
      if (error) throw new BadRequestException(error);

      const ultimo = await m.findOne(HistorialEstado, {
        where: { ordenId: id },
        order: { fecha: 'DESC' },
      });
      const fecha = fechaValida(dto.fecha, ultimo?.fecha ?? orden.fechaIngreso);

      const cambios: Partial<OrdenTrabajo> = { estado: dto.estado, mecanicoId: orden.mecanicoId };
      if (dto.estado === EstadoOrden.TERMINADO) cambios.fechaTerminado = fecha;
      if (dto.estado === EstadoOrden.EN_REPARACION) cambios.fechaTerminado = null;
      if (dto.estado === EstadoOrden.ENTREGADO) cambios.fechaEntrega = fecha;

      // RN-14: al cancelar, los repuestos vuelven al inventario.
      if (dto.estado === EstadoOrden.CANCELADO) {
        for (const linea of lineas) {
          await this.repuestos.moverStock(m, linea.cantidad, TipoMovimiento.DEVOLUCION, {
            tallerId: orden.tallerId,
            repuestoId: linea.repuestoId,
            usuarioId: user.id,
            ordenId: id,
            motivo: `Cancelación ${formatoNumero(orden.numero)}`,
          });
        }
        await m.delete(OrdenRepuesto, { ordenId: id });
        repuestosDevueltos = lineas.map((l) => l.repuestoId);
      }

      await m.update(OrdenTrabajo, id, cambios);
      await m.insert(HistorialEstado, {
        ordenId: id,
        estadoAnterior: orden.estado,
        estadoNuevo: dto.estado,
        usuarioId: user.id,
        comentario: dto.comentario ?? null,
        fecha,
      });

      const vehiculo = await m.findOneByOrFail(Vehiculo, { id: orden.vehiculoId });
      evento = {
        tallerId: orden.tallerId,
        ordenId: id,
        numero: orden.numero,
        placa: vehiculo.placa,
        anterior: orden.estado,
        nuevo: dto.estado,
      };
    });

    if (evento) this.eventos.emit(EVENTOS.ORDEN_ESTADO_CAMBIADO, evento);
    if (repuestosDevueltos.length) {
      this.repuestos.notificarStock(tallerDe(user), repuestosDevueltos);
    }
    return this.obtener(user, id);
  }

  // ---------------------------------------------------------------- repuestos

  /** HU-13 / RN-10: agregar un repuesto descuenta el stock automáticamente. */
  async agregarRepuesto(user: UsuarioActual, id: string, dto: AgregarRepuestoDto) {
    await this.dataSource.transaction(async (m) => {
      const orden = await this.bloquear(m, user, id);
      this.verificarPermiso(user, orden);
      this.verificarEstadoRepuestos(orden);

      if (dto.id && (await m.exists(OrdenRepuesto, { where: { id: dto.id } }))) {
        throw new ConflictException('El repuesto ya fue registrado en la orden');
      }
      const repuesto = await m.findOne(Repuesto, {
        where: { id: dto.repuestoId, tallerId: orden.tallerId },
      });
      if (!repuesto) throw new BadRequestException('El repuesto no existe');
      if (!repuesto.activo) throw new BadRequestException(`"${repuesto.nombre}" está desactivado`);

      await this.repuestos.moverStock(m, -dto.cantidad, TipoMovimiento.SALIDA, {
        tallerId: orden.tallerId,
        repuestoId: repuesto.id,
        usuarioId: user.id,
        ordenId: id,
        motivo: formatoNumero(orden.numero),
      });
      await m.insert(OrdenRepuesto, {
        id: dto.id ?? randomUUID(),
        ordenId: id,
        repuestoId: repuesto.id,
        cantidad: dto.cantidad,
        precioUnitario: repuesto.precioVenta,
        usuarioId: user.id,
      });
      if (orden.sinRepuestos) await m.update(OrdenTrabajo, id, { sinRepuestos: false });
    });

    this.repuestos.notificarStock(tallerDe(user), [dto.repuestoId]);
    return this.obtener(user, id);
  }

  /** Quitar un repuesto de la OT lo devuelve al inventario. */
  async quitarRepuesto(user: UsuarioActual, id: string, lineaId: string) {
    let repuestoId = '';
    await this.dataSource.transaction(async (m) => {
      const orden = await this.bloquear(m, user, id);
      this.verificarPermiso(user, orden);
      this.verificarEstadoRepuestos(orden);

      const linea = await m.findOne(OrdenRepuesto, { where: { id: lineaId, ordenId: id } });
      if (!linea) throw new NotFoundException('El repuesto no está en la orden');

      await this.repuestos.moverStock(m, linea.cantidad, TipoMovimiento.DEVOLUCION, {
        tallerId: orden.tallerId,
        repuestoId: linea.repuestoId,
        usuarioId: user.id,
        ordenId: id,
        motivo: `Quitado de ${formatoNumero(orden.numero)}`,
      });
      await m.delete(OrdenRepuesto, linea.id);
      repuestoId = linea.repuestoId;
    });

    this.repuestos.notificarStock(tallerDe(user), [repuestoId]);
    return this.obtener(user, id);
  }

  // ---------------------------------------------------------------- auxiliares

  /** Lee la OT bloqueando la fila hasta el fin de la transacción. */
  private async bloquear(m: EntityManager, user: UsuarioActual, id: string) {
    const orden = await m.findOne(OrdenTrabajo, {
      where: { id, tallerId: tallerDe(user) },
      lock: { mode: 'pessimistic_write' },
    });
    if (!orden) throw new NotFoundException('Orden de trabajo no encontrada');
    return orden;
  }

  /** El mecánico solo opera órdenes sin asignar o asignadas a él. */
  private verificarPermiso(user: UsuarioActual, orden: OrdenTrabajo) {
    if (user.rol === Rol.MECANICO && orden.mecanicoId && orden.mecanicoId !== user.id) {
      throw new ForbiddenException('Esta orden está asignada a otro mecánico');
    }
  }

  private verificarEstadoRepuestos(orden: OrdenTrabajo) {
    if (!ESTADOS_CON_REPUESTOS.includes(orden.estado)) {
      throw new BadRequestException(
        'Solo se pueden registrar repuestos durante el diagnóstico o la reparación',
      );
    }
  }

  private async verificarMecanico(m: EntityManager, tallerId: string, mecanicoId: string) {
    const mecanico = await m.findOne(Usuario, { where: { id: mecanicoId, tallerId } });
    if (!mecanico || !mecanico.activo) {
      throw new BadRequestException('El mecánico no existe o está desactivado');
    }
  }

  /** Correlativo por taller; bloquea la fila del taller para evitar números repetidos. */
  private async siguienteNumero(m: EntityManager, tallerId: string): Promise<number> {
    await m.query('SELECT id FROM talleres WHERE id = $1 FOR UPDATE', [tallerId]);
    const [{ siguiente }] = await m.query(
      'SELECT COALESCE(MAX(numero), 0) + 1 AS siguiente FROM ordenes_trabajo WHERE taller_id = $1',
      [tallerId],
    );
    return Number(siguiente);
  }
}

/**
 * Las fechas enviadas desde el dispositivo (modo offline) se aceptan si no
 * están en el futuro ni antes del evento anterior; si no, se usa la del servidor.
 */
function fechaValida(fecha?: Date, minimo?: Date): Date {
  const ahora = new Date();
  if (!fecha || isNaN(fecha.getTime()) || fecha > ahora) return ahora;
  if (minimo && fecha < minimo) return new Date(minimo);
  return fecha;
}
