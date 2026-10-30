import { MigrationInterface, QueryRunner } from 'typeorm';

/** RN-33: repuestos elegidos como motivo de ingreso, para cargarlos en el diagnóstico. */
export class RepuestosSugeridos1793000000000 implements MigrationInterface {
  name = 'RepuestosSugeridos1793000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ordenes_trabajo" ADD "repuestos_sugeridos" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ordenes_trabajo" DROP COLUMN "repuestos_sugeridos"`);
  }
}
