import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { numeric } from '../common/utils/numeric.transformer';
import { Usuario } from '../usuarios/usuario.entity';
import { Repuesto } from './repuesto.entity';

export enum TipoMovimiento {
  /** Compra / reposición. */
  ENTRADA = 'ENTRADA',
  /** Uso en una orden de trabajo. */
  SALIDA = 'SALIDA',
  /** Repuesto quitado de una OT o OT cancelada. */
  DEVOLUCION = 'DEVOLUCION',
  /** Corrección tras un conteo físico. */
  AJUSTE = 'AJUSTE',
}

/**
 * Kardex del inventario: cada cambio de stock deja un registro. Permite
 * explicar diferencias entre el stock físico y el registrado, y en la
 * Iteración 3 calcular la rotación de repuestos.
 */
@Entity('movimientos_inventario')
@Index(['repuestoId', 'fecha'])
export class MovimientoInventario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'taller_id', type: 'uuid' })
  tallerId: string;

  @Column({ name: 'repuesto_id', type: 'uuid' })
  repuestoId: string;

  @ManyToOne(() => Repuesto, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'repuesto_id' })
  repuesto: Repuesto;

  @Column({ type: 'enum', enum: TipoMovimiento })
  tipo: TipoMovimiento;

  /** Positivo si suma stock, negativo si resta. */
  @Column({ type: 'numeric', precision: 10, scale: 2, transformer: numeric })
  cantidad: number;

  @Column({
    name: 'stock_resultante',
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: numeric,
  })
  stockResultante: number;

  @Column({ name: 'orden_id', type: 'uuid', nullable: true })
  ordenId: string | null;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ type: 'varchar', length: 200, nullable: true })
  motivo: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  fecha: Date;
}
