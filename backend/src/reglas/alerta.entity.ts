import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum TipoAlerta {
  /** RN-12: repuesto en o por debajo del stock mínimo. */
  STOCK_BAJO = 'STOCK_BAJO',
  /** RN-13: vehículo listo, hay que avisar al cliente. */
  ORDEN_TERMINADA = 'ORDEN_TERMINADA',
  /** HU-27: suscripción por vencer o en período de gracia. */
  SUSCRIPCION = 'SUSCRIPCION',
}

/** Alertas generadas automáticamente por el motor de reglas. */
@Entity('alertas')
// Como máximo una alerta abierta por tipo y referencia (evita duplicados).
@Index('uq_alerta_abierta', ['tipo', 'referenciaId'], { unique: true, where: 'resuelta = false' })
export class Alerta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'taller_id', type: 'uuid' })
  tallerId: string;

  @Column({ type: 'enum', enum: TipoAlerta })
  tipo: TipoAlerta;

  @Column({ type: 'varchar', length: 300 })
  mensaje: string;

  /** Id del repuesto u orden que originó la alerta. */
  @Column({ name: 'referencia_id', type: 'uuid' })
  referenciaId: string;

  @Column({ default: false })
  resuelta: boolean;

  @Column({ name: 'resuelta_en', type: 'timestamptz', nullable: true })
  resueltaEn: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
