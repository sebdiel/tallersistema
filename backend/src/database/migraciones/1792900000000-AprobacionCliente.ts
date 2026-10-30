import { MigrationInterface, QueryRunner } from 'typeorm';

/** RN-32: cuándo y por qué medio aprobó el cliente el presupuesto. */
export class AprobacionCliente1792900000000 implements MigrationInterface {
  name = 'AprobacionCliente1792900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ordenes_trabajo" ADD "aprobado_en" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "ordenes_trabajo" ADD "medio_aprobacion" character varying(10)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ordenes_trabajo" DROP COLUMN "medio_aprobacion"`);
    await queryRunner.query(`ALTER TABLE "ordenes_trabajo" DROP COLUMN "aprobado_en"`);
  }
}
