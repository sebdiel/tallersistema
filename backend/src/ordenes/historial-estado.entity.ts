import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Usuario } from '../usuarios/usuario.entity';
import { EstadoOrden } from './maquina-estados';
import { OrdenTrabajo } from './orden.entity';

/**
 * Bitácora de cambios de estado. Es la fuente de los KPIs de tiempo
 * (tiempo promedio de reparación, tiempo en cada etapa) de la Iteración 3.
 */
@Entity('orden_historial_estados')
@Index(['ordenId', 'fecha'])
export class HistorialEstado {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'orden_id', type: 'uuid' })
  ordenId: string;

  @ManyToOne(() => OrdenTrabajo, (o) => o.historial, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orden_id' })
  orden: OrdenTrabajo;

  @Column({ name: 'estado_anterior', type: 'enum', enum: EstadoOrden, nullable: true })
  estadoAnterior: EstadoOrden | null;

  @Column({ name: 'estado_nuevo', type: 'enum', enum: EstadoOrden })
  estadoNuevo: EstadoOrden;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ type: 'varchar', length: 300, nullable: true })
  comentario: string | null;

  /** Momento real del cambio (en modo offline, cuando se hizo en el dispositivo). */
  @Column({ type: 'timestamptz' })
  fecha: Date;
}
