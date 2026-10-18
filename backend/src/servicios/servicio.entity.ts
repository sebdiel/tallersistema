import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { numeric } from '../common/utils/numeric.transformer';

/**
 * Catálogo de servicios con precio estándar de mano de obra (p. ej.
 * "Cambio de aceite — Bs 50"). Estandariza los presupuestos que hoy se
 * estiman de memoria (problema 3 de la situación problemática).
 */
@Entity('servicios')
@Unique('uq_servicio_taller_nombre', ['tallerId', 'nombre'])
export class Servicio extends BaseEntity {
  @Column({ name: 'taller_id', type: 'uuid' })
  tallerId: string;

  @Column({ type: 'varchar', length: 120 })
  nombre: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, transformer: numeric })
  precio: number;

  /** Tiempo estándar estimado (horas), referencial. */
  @Column({
    name: 'horas_estimadas',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: numeric,
  })
  horasEstimadas: number | null;

  @Column({ default: true })
  activo: boolean;
}
