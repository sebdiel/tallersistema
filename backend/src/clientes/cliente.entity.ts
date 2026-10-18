import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Taller } from '../talleres/taller.entity';
import { Vehiculo } from '../vehiculos/vehiculo.entity';

@Entity('clientes')
@Index(['tallerId', 'nombre'])
export class Cliente extends BaseEntity {
  @Column({ name: 'taller_id', type: 'uuid' })
  tallerId: string;

  @ManyToOne(() => Taller, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taller_id' })
  taller: Taller;

  @Column({ type: 'varchar', length: 120 })
  nombre: string;

  @Column({ name: 'ci_nit', type: 'varchar', length: 20, nullable: true })
  ciNit: string | null;

  @Column({ type: 'varchar', length: 30 })
  telefono: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  direccion: string | null;

  /** RN-04: los clientes no se eliminan, se desactivan. */
  @Column({ default: true })
  activo: boolean;

  @OneToMany(() => Vehiculo, (v) => v.cliente)
  vehiculos: Vehiculo[];
}
