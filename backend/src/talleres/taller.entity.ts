import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';

/**
 * Cada taller es un "inquilino" del sistema. Todos los datos operativos
 * (usuarios, clientes, vehículos, órdenes...) cuelgan de un taller.
 * Los campos de suscripción se agregan en la Iteración 4.
 */
@Entity('talleres')
export class Taller extends BaseEntity {
  @Column({ type: 'varchar', length: 120 })
  nombre: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  direccion: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefono: string | null;

  @Column({ default: true })
  activo: boolean;
}
