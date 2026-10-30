import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { numeric } from '../common/utils/numeric.transformer';
import { OrdenTrabajo } from './orden.entity';

/** CLIENTE: lo compró y trajo el cliente (no se cobra). TALLER: lo compró el taller afuera. */
export enum OrigenRepuestoExterno {
  CLIENTE = 'CLIENTE',
  TALLER = 'TALLER',
}

/** RN-28: repuesto que no sale del inventario del taller. */
@Entity('orden_repuestos_externos')
export class OrdenRepuestoExterno {
  /** Lo genera el cliente (idempotencia en la sincronización offline). */
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'orden_id', type: 'uuid' })
  ordenId: string;

  @ManyToOne(() => OrdenTrabajo, (o) => o.externos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orden_id' })
  orden: OrdenTrabajo;

  @Column({ type: 'varchar', length: 200 })
  descripcion: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, transformer: numeric })
  cantidad: number;

  @Column({ type: 'varchar', length: 10 })
  origen: OrigenRepuestoExterno;

  /** Lo que pagó el taller por unidad (solo TALLER, para conocer la ganancia). */
  @Column({ name: 'costo_unitario', type: 'numeric', precision: 10, scale: 2, nullable: true, transformer: numeric })
  costoUnitario: number | null;

  /** Lo que se cobra al cliente por unidad (0 si lo trajo el cliente). */
  @Column({ name: 'precio_unitario', type: 'numeric', precision: 10, scale: 2, transformer: numeric })
  precioUnitario: number;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  /** RN-29: por qué se cambió el precio después de aprobado el presupuesto. */
  @Column({ name: 'motivo_cambio', type: 'varchar', length: 200, nullable: true })
  motivoCambio: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
