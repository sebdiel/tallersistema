import { MigrationInterface, QueryRunner } from 'typeorm';

/** RN-29: total aceptado por el cliente y motivo de los cambios posteriores. */
export class PresupuestoAprobado1792800000000 implements MigrationInterface {
  name = 'PresupuestoAprobado1792800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ordenes_trabajo" ADD "presupuesto_aprobado" numeric(10,2)`);
    await queryRunner.query(`ALTER TABLE "orden_mano_obra" ADD "motivo_cambio" character varying(200)`);
    await queryRunner.query(`ALTER TABLE "orden_repuestos_externos" ADD "motivo_cambio" character varying(200)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orden_repuestos_externos" DROP COLUMN "motivo_cambio"`);
    await queryRunner.query(`ALTER TABLE "orden_mano_obra" DROP COLUMN "motivo_cambio"`);
    await queryRunner.query(`ALTER TABLE "ordenes_trabajo" DROP COLUMN "presupuesto_aprobado"`);
  }
}
