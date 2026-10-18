import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { numeric } from '../common/utils/numeric.transformer';
import { Taller } from '../talleres/taller.entity';

export const UNIDADES = ['UNIDAD', 'LITRO', 'JUEGO', 'KIT', 'METRO', 'KILO'];

/** Repuesto o insumo del inventario (HU-12). */
@Entity('repuestos')
@Unique('uq_repuesto_taller_codigo', ['tallerId', 'codigo'])
export class Repuesto extends BaseEntity {
  @Column({ name: 'taller_id', type: 'uuid' })
  tallerId: string;

  @ManyToOne(() => Taller, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taller_id' })
  taller: Taller;

  @Column({ type: 'varchar', length: 30 })
  codigo: string;

  @Column({ type: 'varchar', length: 120 })
  nombre: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  marca: string | null;

  @Column({ type: 'varchar', length: 15, default: 'UNIDAD' })
  unidad: string;

  /**
   * Solo se modifica mediante movimientos (entrada, salida a OT, devolución,
   * ajuste) para que cada cambio quede registrado.
   */
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0, transformer: numeric })
  stock: number;

  @Column({
    name: 'stock_minimo',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: numeric,
  })
  stockMinimo: number;

  @Column({
    name: 'precio_compra',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: numeric,
  })
  precioCompra: number;

  @Column({
    name: 'precio_venta',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: numeric,
  })
  precioVenta: number;

  /** Estante / caja donde se guarda físicamente. */
  @Column({ type: 'varchar', length: 60, nullable: true })
  ubicacion: string | null;

  @Column({ default: true })
  activo: boolean;
}
