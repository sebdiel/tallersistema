import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { numeric } from '../common/utils/numeric.transformer';
import { Taller } from '../talleres/taller.entity';
import { Usuario } from '../usuarios/usuario.entity';

/** Pago de la suscripción mensual de un taller (HU-26). */
@Entity('pagos_suscripcion')
@Index(['tallerId', 'createdAt'])
export class PagoSuscripcion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'taller_id', type: 'uuid' })
  tallerId: string;

  @ManyToOne(() => Taller, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taller_id' })
  taller: Taller;

  @Column({ type: 'numeric', precision: 10, scale: 2, transformer: numeric })
  monto: number;

  @Column({ type: 'smallint' })
  meses: number;

  /** Período que cubre el pago. */
  @Column({ type: 'date' })
  desde: string;

  @Column({ type: 'date' })
  hasta: string;

  @Column({ type: 'varchar', length: 20 })
  metodo: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  referencia: string | null;

  @Column({ name: 'registrado_por_id', type: 'uuid' })
  registradoPorId: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'registrado_por_id' })
  registradoPor: Usuario;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
