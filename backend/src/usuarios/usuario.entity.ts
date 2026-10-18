import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Rol } from '../common/enums/rol.enum';
import { Taller } from '../talleres/taller.entity';

@Entity('usuarios')
export class Usuario extends BaseEntity {
  @Column({ type: 'varchar', length: 120 })
  nombre: string;

  @Column({ type: 'varchar', length: 120, unique: true })
  email: string;

  @Column({ name: 'password_hash', select: false })
  passwordHash: string;

  @Column({ type: 'enum', enum: Rol, default: Rol.MECANICO })
  rol: Rol;

  /** RN-03: un usuario inactivo no puede iniciar sesión. */
  @Column({ default: true })
  activo: boolean;

  /** Nulo solo para el SUPERADMIN. */
  @Column({ name: 'taller_id', type: 'uuid', nullable: true })
  tallerId: string | null;

  @ManyToOne(() => Taller, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taller_id' })
  taller: Taller;
}
