import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Unique,
} from 'typeorm';
import { Cliente } from '../clientes/cliente.entity';
import { BaseEntity } from '../common/entities/base.entity';
import { Taller } from '../talleres/taller.entity';
import { Usuario } from '../usuarios/usuario.entity';
import { Vehiculo } from '../vehiculos/vehiculo.entity';
import { HistorialEstado } from './historial-estado.entity';
import { EstadoOrden } from './maquina-estados';
import { OrdenRepuesto } from './orden-repuesto.entity';

/** Orden de trabajo (OT): ciclo de vida del servicio vehicular (HU-09). */
@Entity('ordenes_trabajo')
@Unique('uq_orden_taller_numero', ['tallerId', 'numero'])
@Index(['tallerId', 'estado'])
export class OrdenTrabajo extends BaseEntity {
  @Column({ name: 'taller_id', type: 'uuid' })
  tallerId: string;

  @ManyToOne(() => Taller, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taller_id' })
  taller: Taller;

  /**
   * Correlativo por taller (OT-0001, OT-0002...). Lo asigna siempre el
   * servidor, también para órdenes creadas sin conexión.
   */
  @Column({ type: 'integer' })
  numero: number;

  @Column({ name: 'vehiculo_id', type: 'uuid' })
  vehiculoId: string;

  @ManyToOne(() => Vehiculo, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vehiculo_id' })
  vehiculo: Vehiculo;

  /** Propietario al momento del ingreso (el vehículo podría cambiar de dueño). */
  @Column({ name: 'cliente_id', type: 'uuid' })
  clienteId: string;

  @ManyToOne(() => Cliente, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cliente_id' })
  cliente: Cliente;

  @Column({ name: 'mecanico_id', type: 'uuid', nullable: true })
  mecanicoId: string | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'mecanico_id' })
  mecanico: Usuario | null;

  @Column({ name: 'creado_por_id', type: 'uuid' })
  creadoPorId: string;

  @Column({ type: 'enum', enum: EstadoOrden, default: EstadoOrden.RECIBIDO })
  estado: EstadoOrden;

  @Column({ name: 'problema_reportado', type: 'text' })
  problemaReportado: string;

  /** Estado visual del vehículo al ingresar (rayones, objetos, nivel de combustible). */
  @Column({ name: 'observaciones_recepcion', type: 'text', nullable: true })
  observacionesRecepcion: string | null;

  @Column({ type: 'text', nullable: true })
  diagnostico: string | null;

  @Column({ name: 'kilometraje_ingreso', type: 'integer' })
  kilometrajeIngreso: number;

  /** El mecánico confirma explícitamente que el trabajo no usó repuestos (RN-11). */
  @Column({ name: 'sin_repuestos', default: false })
  sinRepuestos: boolean;

  @Column({ name: 'fecha_ingreso', type: 'timestamptz' })
  fechaIngreso: Date;

  @Column({ name: 'fecha_terminado', type: 'timestamptz', nullable: true })
  fechaTerminado: Date | null;

  @Column({ name: 'fecha_entrega', type: 'timestamptz', nullable: true })
  fechaEntrega: Date | null;

  @OneToMany(() => OrdenRepuesto, (r) => r.orden)
  repuestos: OrdenRepuesto[];

  @OneToMany(() => HistorialEstado, (h) => h.orden)
  historial: HistorialEstado[];
}
