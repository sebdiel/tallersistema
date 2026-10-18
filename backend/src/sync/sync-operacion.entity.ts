import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Registro de operaciones offline ya procesadas. Si el dispositivo reenvía
 * una operación (p. ej. se cortó la conexión antes de recibir la respuesta),
 * se devuelve el resultado guardado en lugar de ejecutarla dos veces.
 */
@Entity('sync_operaciones')
export class SyncOperacion {
  /** Id generado en el dispositivo. */
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'taller_id', type: 'uuid' })
  tallerId: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ type: 'varchar', length: 40 })
  tipo: string;

  @Column()
  ok: boolean;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  /** Cuándo se hizo la operación en el dispositivo. */
  @Column({ name: 'creada_en', type: 'timestamptz' })
  creadaEn: Date;

  @CreateDateColumn({ name: 'procesada_en', type: 'timestamptz' })
  procesadaEn: Date;
}
