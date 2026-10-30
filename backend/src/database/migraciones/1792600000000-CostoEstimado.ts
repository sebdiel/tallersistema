import { MigrationInterface, QueryRunner } from 'typeorm';

/** RN-27: costo aproximado informado al cliente al recibir el vehículo. */
export class CostoEstimado1792600000000 implements MigrationInterface {
  name = 'CostoEstimado1792600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ordenes_trabajo" ADD "costo_estimado" numeric(10,2)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ordenes_trabajo" DROP COLUMN "costo_estimado"`);
  }
}
