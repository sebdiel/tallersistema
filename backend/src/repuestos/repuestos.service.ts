import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { UsuarioActual } from '../common/decorators/auth.decorators';
import { tallerDe } from '../common/utils/taller.util';
import { EVENTOS, StockCambiadoEvent } from '../reglas/eventos';
import {
  AjusteStockDto,
  CreateRepuestoDto,
  EntradaStockDto,
  UpdateRepuestoDto,
} from './dto/repuesto.dto';
import { MovimientoInventario, TipoMovimiento } from './movimiento.entity';
import { Repuesto } from './repuesto.entity';

interface MovimientoParams {
  tallerId: string;
  repuestoId: string;
  usuarioId: string;
  ordenId?: string | null;
  motivo?: string | null;
}

@Injectable()
export class RepuestosService {
  constructor(
    @InjectRepository(Repuesto) private readonly repo: Repository<Repuesto>,
    @InjectRepository(MovimientoInventario)
    private readonly movimientos: Repository<MovimientoInventario>,
    private readonly dataSource: DataSource,
    private readonly eventos: EventEmitter2,
  ) {}

  buscar(user: UsuarioActual, q?: string, soloBajoStock = false, incluirInactivos = false) {
    const qb = this.repo
      .createQueryBuilder('r')
      .where('r.taller_id = :tallerId', { tallerId: tallerDe(user) })
      .orderBy('r.nombre', 'ASC');

    if (!incluirInactivos) qb.andWhere('r.activo = true');
    // HU-14: repuestos en o por debajo del stock mínimo.
    if (soloBajoStock) qb.andWhere('r.stock <= r.stock_minimo');
    if (q?.trim()) {
      qb.andWhere('(r.codigo ILIKE :q OR r.nombre ILIKE :q OR r.marca ILIKE :q)', {
        q: `%${q.trim()}%`,
      });
    }
    return qb.getMany();
  }

  async obtener(user: UsuarioActual, id: string) {
    const repuesto = await this.repo.findOne({ where: { id, tallerId: tallerDe(user) } });
    if (!repuesto) throw new NotFoundException('Repuesto no encontrado');
    return repuesto;
  }

  async detalle(user: UsuarioActual, id: string) {
    const repuesto = await this.obtener(user, id);
    const movimientos = await this.movimientos.find({
      where: { repuestoId: id },
      relations: { usuario: true },
      order: { fecha: 'DESC' },
      take: 30,
    });
    return {
      repuesto,
      movimientos: movimientos.map(({ usuario, ...m }) => ({
        ...m,
        usuario: usuario ? { id: usuario.id, nombre: usuario.nombre } : null,
      })),
    };
  }

  async crear(user: UsuarioActual, dto: CreateRepuestoDto) {
    const tallerId = tallerDe(user);
    if (await this.repo.exists({ where: { tallerId, codigo: dto.codigo } })) {
      throw new ConflictException('Ya existe un repuesto con ese código');
    }
    const { stock = 0, ...datos } = dto;

    const id = await this.dataSource.transaction(async (m) => {
      const repuesto = await m.save(Repuesto, m.create(Repuesto, { ...datos, tallerId, stock: 0 }));
      if (stock > 0) {
        await this.moverStock(m, stock, TipoMovimiento.ENTRADA, {
          tallerId,
          repuestoId: repuesto.id,
          usuarioId: user.id,
          motivo: 'Stock inicial',
        });
      }
      return repuesto.id;
    });

    this.notificarStock(tallerId, [id]);
    return this.obtener(user, id);
  }

  async actualizar(user: UsuarioActual, id: string, dto: UpdateRepuestoDto) {
    const repuesto = await this.obtener(user, id);
    if (dto.codigo && dto.codigo !== repuesto.codigo) {
      if (await this.repo.exists({ where: { tallerId: repuesto.tallerId, codigo: dto.codigo } })) {
        throw new ConflictException('Ya existe un repuesto con ese código');
      }
    }
    await this.repo.save({ ...repuesto, ...dto });
    // Cambiar el stock mínimo puede activar o resolver una alerta.
    this.notificarStock(repuesto.tallerId, [id]);
    return this.obtener(user, id);
  }

  /** Reposición de stock (compra). */
  async registrarEntrada(user: UsuarioActual, id: string, dto: EntradaStockDto) {
    const repuesto = await this.obtener(user, id);
    await this.dataSource.transaction(async (m) => {
      await this.moverStock(m, dto.cantidad, TipoMovimiento.ENTRADA, {
        tallerId: repuesto.tallerId,
        repuestoId: id,
        usuarioId: user.id,
        motivo: dto.motivo ?? 'Compra / reposición',
      });
      if (dto.precioCompra !== undefined) {
        await m.update(Repuesto, id, { precioCompra: dto.precioCompra });
      }
    });
    this.notificarStock(repuesto.tallerId, [id]);
    return this.obtener(user, id);
  }

  /** Corrige el stock tras un conteo físico (solo ADMIN). */
  async ajustar(user: UsuarioActual, id: string, dto: AjusteStockDto) {
    const repuesto = await this.obtener(user, id);
    const diferencia = Math.round((dto.stockReal - repuesto.stock) * 100) / 100;
    if (diferencia === 0) throw new BadRequestException('El stock ya coincide con el conteo');

    await this.dataSource.transaction((m) =>
      this.moverStock(m, diferencia, TipoMovimiento.AJUSTE, {
        tallerId: repuesto.tallerId,
        repuestoId: id,
        usuarioId: user.id,
        motivo: dto.motivo,
      }),
    );
    this.notificarStock(repuesto.tallerId, [id]);
    return this.obtener(user, id);
  }

  /**
   * Suma (cantidad > 0) o resta (cantidad < 0) stock de forma atómica y
   * registra el movimiento. Debe ejecutarse dentro de una transacción.
   *
   * RN-10: la condición `stock + cantidad >= 0` se evalúa en la misma
   * sentencia UPDATE, por lo que dos usuarios descontando a la vez el
   * último repuesto nunca dejan el stock en negativo.
   */
  async moverStock(
    m: EntityManager,
    cantidad: number,
    tipo: TipoMovimiento,
    p: MovimientoParams,
  ): Promise<number> {
    const resultado = await m.query(
      `UPDATE repuestos
          SET stock = stock + $1, updated_at = now()
        WHERE id = $2 AND taller_id = $3 AND stock + $1 >= 0
        RETURNING stock, nombre`,
      [cantidad, p.repuestoId, p.tallerId],
    );
    // En PostgreSQL, TypeORM devuelve [filas, afectadas] para UPDATE.
    const filas: { stock: string; nombre: string }[] = Array.isArray(resultado[0])
      ? resultado[0]
      : resultado;

    if (filas.length === 0) {
      const actual = await m.findOne(Repuesto, {
        where: { id: p.repuestoId, tallerId: p.tallerId },
      });
      if (!actual) throw new NotFoundException('Repuesto no encontrado');
      throw new ConflictException(
        `Stock insuficiente de "${actual.nombre}": disponible ${actual.stock} ${actual.unidad.toLowerCase()}`,
      );
    }

    const stockResultante = Number(filas[0].stock);
    await m.insert(MovimientoInventario, {
      tallerId: p.tallerId,
      repuestoId: p.repuestoId,
      usuarioId: p.usuarioId,
      ordenId: p.ordenId ?? null,
      motivo: p.motivo ?? null,
      tipo,
      cantidad,
      stockResultante,
    });
    return stockResultante;
  }

  /** Avisa al motor de reglas (RN-12: alerta de stock mínimo). */
  notificarStock(tallerId: string, repuestoIds: string[]) {
    const evento: StockCambiadoEvent = { tallerId, repuestoIds };
    this.eventos.emit(EVENTOS.STOCK_CAMBIADO, evento);
  }
}
