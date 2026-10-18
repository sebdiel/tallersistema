import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Cliente } from '../clientes/cliente.entity';
import { Taller } from '../talleres/taller.entity';

/** Ficha técnica vehicular (HU-06). */
@Entity('vehiculos')
@Unique('uq_vehiculo_taller_placa', ['tallerId', 'placa']) // RN-01
export class Vehiculo extends BaseEntity {
  @Column({ name: 'taller_id', type: 'uuid' })
  tallerId: string;

  @ManyToOne(() => Taller, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taller_id' })
  taller: Taller;

  @Column({ name: 'cliente_id', type: 'uuid' })
  clienteId: string;

  @ManyToOne(() => Cliente, (c) => c.vehiculos, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cliente_id' })
  cliente: Cliente;

  /** Normalizada: mayúsculas, sin espacios ni guiones. */
  @Column({ type: 'varchar', length: 15 })
  placa: string;

  @Column({ type: 'varchar', length: 50 })
  marca: string;

  @Column({ type: 'varchar', length: 50 })
  modelo: string;

  @Column({ type: 'smallint', nullable: true })
  anio: number | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  color: string | null;

  @Column({ name: 'nro_chasis', type: 'varchar', length: 30, nullable: true })
  nroChasis: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  combustible: string | null;

  /** Último kilometraje conocido; se actualiza al recibir el vehículo. */
  @Column({ type: 'integer', default: 0 })
  kilometraje: number;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;
}
