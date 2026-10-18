import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { numeric } from '../common/utils/numeric.transformer';
import { Usuario } from '../usuarios/usuario.entity';
import { OrdenTrabajo } from './orden.entity';

export enum MetodoPago {
  EFECTIVO = 'EFECTIVO',
  QR = 'QR',
  TRANSFERENCIA = 'TRANSFERENCIA',
  TARJETA = 'TARJETA',
}

/** Pago (total o parcial / adelanto) de una OT (HU-21). */
@Entity('pagos')
@Index(['tallerId', 'fecha'])
export class Pago {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'taller_id', type: 'uuid' })
  tallerId: string;

  @Column({ name: 'orden_id', type: 'uuid' })
  ordenId: string;

  @ManyToOne(() => OrdenTrabajo, (o) => o.pagos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orden_id' })
  orden: OrdenTrabajo;

  @Column({ type: 'numeric', precision: 10, scale: 2, transformer: numeric })
  monto: number;

  @Column({ type: 'enum', enum: MetodoPago, default: MetodoPago.EFECTIVO })
  metodo: MetodoPago;

  /** N.º de transacción QR / transferencia. */
  @Column({ type: 'varchar', length: 60, nullable: true })
  referencia: string | null;

  /** Momento del cobro (en modo offline, cuando se cobró en el dispositivo). */
  @Column({ type: 'timestamptz' })
  fecha: Date;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  /** Los pagos no se borran: se anulan con motivo (trazabilidad). */
  @Column({ default: false })
  anulado: boolean;

  @Column({ name: 'motivo_anulacion', type: 'varchar', length: 200, nullable: true })
  motivoAnulacion: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
