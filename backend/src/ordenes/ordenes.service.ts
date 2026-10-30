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
import { Servicio } from '../servicios/servicio.entity';
import { Totales, calcularTotales } from './costos';
import {
  AgregarManoObraDto,
  AgregarRepuestoDto,
  AgregarRepuestoExternoDto,
  AnularPagoDto,
  AsignarMecanicoDto,
  CambiarEstadoDto,
  CreateOrdenDto,
  DescuentoDto,
  EditarManoObraDto,
  EditarRepuestoExternoDto,
  FiltroOrdenesDto,
  RegistrarPagoDto,
  UpdateOrdenDto,
} from './dto/orden.dto';
import { HistorialEstado } from './historial-estado.entity';
import {
  ESTADOS_ABIERTOS,
  ESTADOS_CON_REPUESTOS,
  EstadoOrden,
  validarTransicion,
} from './maquina-estados';
import { OrdenManoObra } from './orden-mano-obra.entity';
import { OrdenRepuesto } from './orden-repuesto.entity';
import { OrdenRepuestoExterno, OrigenRepuestoExterno } from './orden-repuesto-externo.entity';
import { OrdenTrabajo } from './orden.entity';
import { Pago } from './pago.entity';

export const formatoNumero = (n: number) => `OT-${String(n).padStart(4, '0')}`;

/** Mano de obra, descuento y pagos se pueden modificar mientras la OT está abierta. */
const ESTADOS_CON_COSTOS = ESTADOS_ABIERTOS;

/** Agrega los totales calculados (RN-15) a la respuesta. */
const conTotales = <T extends OrdenTrabajo>(o: T): T & { totales: Totales } => ({
  ...o,
  totales: calcularTotales(o),
});

@Injectable()
export class OrdenesService {
  constructor(
    @InjectRepository(OrdenTrabajo) private readonly repo: Repository<OrdenTrabajo>,
    private readonly dataSource: DataSource,
    private readonly repuestos: RepuestosService,
    private readonly eventos: EventEmitter2,
  ) {}

  // ---------------------------------------------------------------- consultas

  async listar(user: UsuarioActual, f: FiltroOrdenesDto) {
    const qb = this.repo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.vehiculo', 'v')
      .leftJoinAndSelect('o.cliente', 'c')
      .leftJoinAndSelect('o.mecanico', 'm')
      .leftJoinAndSelect('o.repuestos', 'r')
      .leftJoinAndSelect('r.repuesto', 'rp')
      .leftJoinAndSelect('o.manoObra', 'mo')
      .leftJoinAndSelect('o.externos', 'ex')
      .leftJoinAndSelect('o.pagos', 'pg')
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
    return (await qb.getMany()).map(conTotales);
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
        manoObra: { mecanico: true },
        externos: true,
        pagos: { usuario: true },
      },
      order: {
        repuestos: { createdAt: 'ASC' },
        historial: { fecha: 'ASC' },
        manoObra: { createdAt: 'ASC' },
        externos: { createdAt: 'ASC' },
        pagos: { fecha: 'ASC' },
      },
    });
    if (!orden) throw new NotFoundException('Orden de trabajo no encontrada');
    return conTotales(orden);
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
        fechaEntregaEstimada: validarEntregaEstimada(dto.fechaEntregaEstimada, fechaIngreso),
        costoEstimado: dto.costoEstimado ?? null,
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
      if (dto.fechaEntregaEstimada !== undefined) {
        dto.fechaEntregaEstimada = validarEntregaEstimada(dto.fechaEntregaEstimada, orden.fechaIngreso);
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
      const totales = await this.totalesDe(m, orden);
      const error = validarTransicion(
        {
          ...orden,
          // RN-11: los repuestos externos también cuentan como repuestos registrados.
          totalRepuestos:
            lineas.length + (await m.count(OrdenRepuestoExterno, { where: { ordenId: id } })),
          saldo: totales.saldo,
          pagado: totales.pagado,
          esAdmin: user.rol === Rol.ADMIN,
        },
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
      // RN-29: al pasar de diagnóstico a reparación se guarda el total que aceptó el cliente.
      if (orden.estado === EstadoOrden.EN_DIAGNOSTICO && dto.estado === EstadoOrden.EN_REPARACION) {
        cambios.presupuestoAprobado = totales.total;
      }
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
        costoUnitario: repuesto.precioCompra,
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
      await this.verificarTotalCubrePagos(m, orden, linea.cantidad * linea.precioUnitario);

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

  // ------------------------------------------------- costos y pagos (Iteración 3)

  /** HU-18: agregar mano de obra (libre o desde el catálogo de servicios). */
  async agregarManoObra(user: UsuarioActual, id: string, dto: AgregarManoObraDto) {
    await this.dataSource.transaction(async (m) => {
      const orden = await this.bloquear(m, user, id);
      this.verificarPermiso(user, orden);
      this.verificarEstadoCostos(orden);

      if (dto.id && (await m.exists(OrdenManoObra, { where: { id: dto.id } }))) {
        throw new ConflictException('La mano de obra ya fue registrada');
      }
      let descripcion = dto.descripcion;
      let monto = dto.monto;
      if (dto.servicioId) {
        const servicio = await m.findOne(Servicio, {
          where: { id: dto.servicioId, tallerId: orden.tallerId },
        });
        if (!servicio) throw new BadRequestException('El servicio no existe');
        descripcion ??= servicio.nombre;
        monto ??= servicio.precio;
      }
      if (!descripcion) throw new BadRequestException('Describa el trabajo realizado');
      if (monto === undefined) throw new BadRequestException('Indique el monto de la mano de obra');

      const mecanicoId = dto.mecanicoId ?? orden.mecanicoId;
      if (mecanicoId) await this.verificarMecanico(m, orden.tallerId, mecanicoId);

      await m.insert(OrdenManoObra, {
        id: dto.id ?? randomUUID(),
        ordenId: id,
        servicioId: dto.servicioId ?? null,
        descripcion,
        monto,
        mecanicoId,
        usuarioId: user.id,
      });
    });
    return this.obtener(user, id);
  }

  async quitarManoObra(user: UsuarioActual, id: string, lineaId: string) {
    await this.dataSource.transaction(async (m) => {
      const orden = await this.bloquear(m, user, id);
      this.verificarPermiso(user, orden);
      this.verificarEstadoCostos(orden);
      const linea = await m.findOne(OrdenManoObra, { where: { id: lineaId, ordenId: id } });
      if (!linea) throw new NotFoundException('La mano de obra no está en la orden');
      await this.verificarTotalCubrePagos(m, orden, linea.monto);
      await m.delete(OrdenManoObra, linea.id);
    });
    return this.obtener(user, id);
  }

  /** RN-28: repuesto que trae el cliente o que el taller compra afuera (no toca el inventario). */
  async agregarRepuestoExterno(user: UsuarioActual, id: string, dto: AgregarRepuestoExternoDto) {
    await this.dataSource.transaction(async (m) => {
      const orden = await this.bloquear(m, user, id);
      this.verificarPermiso(user, orden);
      this.verificarEstadoCostos(orden);
      if (dto.id && (await m.exists(OrdenRepuestoExterno, { where: { id: dto.id } }))) {
        throw new ConflictException('El repuesto ya fue registrado');
      }
      const delCliente = dto.origen === OrigenRepuestoExterno.CLIENTE;
      if (!delCliente && dto.precioUnitario == null) {
        throw new BadRequestException('Indique cuánto se cobra por el repuesto');
      }
      await m.insert(OrdenRepuestoExterno, {
        id: dto.id ?? randomUUID(),
        ordenId: id,
        descripcion: dto.descripcion,
        cantidad: dto.cantidad,
        origen: dto.origen,
        costoUnitario: delCliente ? null : (dto.costoUnitario ?? null),
        precioUnitario: delCliente ? 0 : dto.precioUnitario!,
        usuarioId: user.id,
      });
    });
    return this.obtener(user, id);
  }

  async quitarRepuestoExterno(user: UsuarioActual, id: string, lineaId: string) {
    await this.dataSource.transaction(async (m) => {
      const orden = await this.bloquear(m, user, id);
      this.verificarPermiso(user, orden);
      this.verificarEstadoCostos(orden);
      const linea = await m.findOne(OrdenRepuestoExterno, { where: { id: lineaId, ordenId: id } });
      if (!linea) throw new NotFoundException('El repuesto no está en la orden');
      await this.verificarTotalCubrePagos(m, orden, linea.cantidad * linea.precioUnitario);
      await m.delete(OrdenRepuestoExterno, linea.id);
    });
    return this.obtener(user, id);
  }

  /** RN-29: corregir el precio o la cantidad de un repuesto externo. */
  async editarRepuestoExterno(user: UsuarioActual, id: string, lineaId: string, dto: EditarRepuestoExternoDto) {
    await this.dataSource.transaction(async (m) => {
      const orden = await this.bloquear(m, user, id);
      this.verificarPermiso(user, orden);
      this.verificarEstadoCostos(orden);
      const linea = await m.findOne(OrdenRepuestoExterno, { where: { id: lineaId, ordenId: id } });
      if (!linea) throw new NotFoundException('El repuesto no está en la orden');

      const delCliente = linea.origen === OrigenRepuestoExterno.CLIENTE;
      const cantidad = dto.cantidad ?? linea.cantidad;
      const precioUnitario = delCliente ? 0 : (dto.precioUnitario ?? linea.precioUnitario);
      const baja = linea.cantidad * linea.precioUnitario - cantidad * precioUnitario;
      if (baja > 0) await this.verificarTotalCubrePagos(m, orden, baja);

      await m.update(OrdenRepuestoExterno, linea.id, {
        cantidad,
        precioUnitario,
        costoUnitario: delCliente ? null : dto.costoUnitario !== undefined ? dto.costoUnitario : linea.costoUnitario,
        motivoCambio: dto.motivo ?? linea.motivoCambio,
      });
    });
    return this.obtener(user, id);
  }

  /** RN-29: corregir la descripción o el monto de una línea de mano de obra. */
  async editarManoObra(user: UsuarioActual, id: string, lineaId: string, dto: EditarManoObraDto) {
    await this.dataSource.transaction(async (m) => {
      const orden = await this.bloquear(m, user, id);
      this.verificarPermiso(user, orden);
      this.verificarEstadoCostos(orden);
      const linea = await m.findOne(OrdenManoObra, { where: { id: lineaId, ordenId: id } });
      if (!linea) throw new NotFoundException('La mano de obra no está en la orden');

      const monto = dto.monto ?? linea.monto;
      if (linea.monto - monto > 0) await this.verificarTotalCubrePagos(m, orden, linea.monto - monto);

      await m.update(OrdenManoObra, linea.id, {
        descripcion: dto.descripcion ?? linea.descripcion,
        monto,
        motivoCambio: dto.motivo ?? linea.motivoCambio,
      });
    });
    return this.obtener(user, id);
  }

  /** RN-16: descuento solo del administrador y nunca mayor al subtotal. */
  async aplicarDescuento(user: UsuarioActual, id: string, dto: DescuentoDto) {
    await this.dataSource.transaction(async (m) => {
      const orden = await this.bloquear(m, user, id);
      this.verificarEstadoCostos(orden);
      const t = await this.totalesDe(m, orden);
      if (dto.descuento > t.subtotal) {
        throw new BadRequestException(
          `El descuento no puede superar el subtotal (Bs ${t.subtotal.toFixed(2)})`,
        );
      }
      // RN-17: el nuevo total no puede quedar por debajo de lo ya cobrado.
      if (t.subtotal - dto.descuento < t.pagado - 0.001) {
        throw new BadRequestException(
          `Con ese descuento el total quedaría por debajo de lo ya pagado (Bs ${t.pagado.toFixed(2)})`,
        );
      }
      await m.update(OrdenTrabajo, id, { descuento: dto.descuento });
    });
    return this.obtener(user, id);
  }

  /** HU-21 / RN-17: registrar un pago (total, parcial o adelanto) sin exceder el saldo. */
  async registrarPago(user: UsuarioActual, id: string, dto: RegistrarPagoDto) {
    await this.dataSource.transaction(async (m) => {
      const orden = await this.bloquear(m, user, id);
      if (orden.estado === EstadoOrden.CANCELADO) {
        throw new BadRequestException('No se registran pagos en una orden cancelada');
      }
      if (dto.id && (await m.exists(Pago, { where: { id: dto.id } }))) {
        throw new ConflictException('El pago ya fue registrado');
      }
      const t = await this.totalesDe(m, orden);
      if (dto.monto > t.saldo + 0.001) {
        throw new BadRequestException(
          t.saldo <= 0
            ? 'La orden no tiene saldo pendiente'
            : `El pago supera el saldo pendiente (Bs ${t.saldo.toFixed(2)})`,
        );
      }
      await m.insert(Pago, {
        id: dto.id ?? randomUUID(),
        tallerId: orden.tallerId,
        ordenId: id,
        monto: dto.monto,
        metodo: dto.metodo,
        referencia: dto.referencia ?? null,
        fecha: fechaValida(dto.fecha, orden.fechaIngreso),
        usuarioId: user.id,
      });
    });
    return this.obtener(user, id);
  }

  /** Los pagos no se eliminan: se anulan con motivo (solo ADMIN). */
  async anularPago(user: UsuarioActual, id: string, pagoId: string, dto: AnularPagoDto) {
    await this.dataSource.transaction(async (m) => {
      await this.bloquear(m, user, id);
      const pago = await m.findOne(Pago, { where: { id: pagoId, ordenId: id } });
      if (!pago) throw new NotFoundException('Pago no encontrado');
      if (pago.anulado) throw new BadRequestException('El pago ya está anulado');
      await m.update(Pago, pagoId, { anulado: true, motivoAnulacion: dto.motivo });
    });
    return this.obtener(user, id);
  }

  // ---------------------------------------------------------------- auxiliares

  private async totalesDe(m: EntityManager, orden: OrdenTrabajo): Promise<Totales> {
    const [repuestos, manoObra, externos, pagos] = await Promise.all([
      m.find(OrdenRepuesto, { where: { ordenId: orden.id } }),
      m.find(OrdenManoObra, { where: { ordenId: orden.id } }),
      m.find(OrdenRepuestoExterno, { where: { ordenId: orden.id } }),
      m.find(Pago, { where: { ordenId: orden.id } }),
    ]);
    return calcularTotales({ descuento: orden.descuento, repuestos, manoObra, externos, pagos });
  }

  /** RN-17: quitar un cargo no puede dejar el total por debajo de lo ya pagado. */
  private async verificarTotalCubrePagos(m: EntityManager, orden: OrdenTrabajo, montoQuitado: number) {
    const t = await this.totalesDe(m, orden);
    if (t.total - montoQuitado < t.pagado - 0.001) {
      throw new BadRequestException(
        `No se puede quitar: el total quedaría por debajo de lo ya pagado (Bs ${t.pagado.toFixed(2)}). Anule el pago primero`,
      );
    }
  }

  private verificarEstadoCostos(orden: OrdenTrabajo) {
    if (!ESTADOS_CON_COSTOS.includes(orden.estado)) {
      throw new BadRequestException('Los costos de una orden cerrada ya no se pueden modificar');
    }
  }


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
/** RN-26: la entrega estimada no puede ser anterior al ingreso. */
function validarEntregaEstimada(fecha: string | null | undefined, ingreso: Date): string | null {
  if (!fecha) return null;
  const dia = new Date(ingreso.getTime() - 4 * 3_600_000).toISOString().slice(0, 10);
  if (fecha < dia) throw new BadRequestException('La fecha de entrega no puede ser anterior a la de recepción');
  return fecha;
}

function fechaValida(fecha?: Date, minimo?: Date): Date {
  const ahora = new Date();
  if (!fecha || isNaN(fecha.getTime()) || fecha > ahora) return ahora;
  if (minimo && fecha < minimo) return new Date(minimo);
  return fecha;
}
