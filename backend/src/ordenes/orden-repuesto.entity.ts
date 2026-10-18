import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { numeric } from '../common/utils/numeric.transformer';
import { Repuesto } from '../repuestos/repuesto.entity';
import { OrdenTrabajo } from './orden.entity';

/** Repuesto utilizado en una orden de trabajo (HU-13). */
@Entity('orden_repuestos')
export class OrdenRepuesto {
  /** Lo genera el cliente para que reintentar una sincronización no lo duplique. */
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'orden_id', type: 'uuid' })
  ordenId: string;

  @ManyToOne(() => OrdenTrabajo, (o) => o.repuestos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orden_id' })
  orden: OrdenTrabajo;

  @Column({ name: 'repuesto_id', type: 'uuid' })
  repuestoId: string;

  @ManyToOne(() => Repuesto, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'repuesto_id' })
  repuesto: Repuesto;

  @Column({ type: 'numeric', precision: 10, scale: 2, transformer: numeric })
  cantidad: number;

  /**
   * Precio de venta vigente cuando se usó el repuesto. Se guarda aquí para
   * que un cambio de precio posterior no altere el costo de la OT (Iteración 3).
   */
  @Column({
    name: 'precio_unitario',
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: numeric,
  })
  precioUnitario: number;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
