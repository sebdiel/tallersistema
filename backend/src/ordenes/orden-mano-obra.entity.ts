import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { numeric } from '../common/utils/numeric.transformer';
import { Usuario } from '../usuarios/usuario.entity';
import { OrdenTrabajo } from './orden.entity';

/** Línea de mano de obra de la OT (HU-18). */
@Entity('orden_mano_obra')
export class OrdenManoObra {
  /** Lo genera el cliente (idempotencia en la sincronización offline). */
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'orden_id', type: 'uuid' })
  ordenId: string;

  @ManyToOne(() => OrdenTrabajo, (o) => o.manoObra, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orden_id' })
  orden: OrdenTrabajo;

  /** Servicio del catálogo del que se tomó el precio estándar (opcional). */
  @Column({ name: 'servicio_id', type: 'uuid', nullable: true })
  servicioId: string | null;

  @Column({ type: 'varchar', length: 200 })
  descripcion: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, transformer: numeric })
  monto: number;

  /** Mecánico que realizó el trabajo (para el KPI de productividad). */
  @Column({ name: 'mecanico_id', type: 'uuid', nullable: true })
  mecanicoId: string | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'mecanico_id' })
  mecanico: Usuario | null;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
