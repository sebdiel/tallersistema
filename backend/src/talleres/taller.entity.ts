import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';

/**
 * Cada taller es un "inquilino" del sistema. Todos los datos operativos
 * (usuarios, clientes, vehículos, órdenes...) cuelgan de un taller.
 */
@Entity('talleres')
export class Taller extends BaseEntity {
  @Column({ type: 'varchar', length: 120 })
  nombre: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  direccion: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefono: string | null;

  /** false = suspendido manualmente por el SUPERADMIN (RN-22). */
  @Column({ default: true })
  activo: boolean;

  // ------------------------------------------------ Iteración 4: suscripción

  @Column({ type: 'varchar', length: 20, nullable: true })
  nit: string | null;

  /** Persona de contacto para cobros y soporte. */
  @Column({ name: 'contacto_nombre', type: 'varchar', length: 120, nullable: true })
  contactoNombre: string | null;

  /** Último día pagado (AAAA-MM-DD). Nuevos talleres: 15 días de prueba. */
  @Column({ name: 'vigente_hasta', type: 'date', default: () => "(CURRENT_DATE + 15)" })
  vigenteHasta: string;

  @Column({ name: 'motivo_suspension', type: 'varchar', length: 200, nullable: true })
  motivoSuspension: string | null;

  @Column({ type: 'text', nullable: true })
  notas: string | null;
}
