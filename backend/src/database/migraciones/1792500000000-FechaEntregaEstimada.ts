import { MigrationInterface, QueryRunner } from 'typeorm';

/** RN-26: fecha de entrega acordada con el cliente al recibir el vehículo. */
export class FechaEntregaEstimada1792500000000 implements MigrationInterface {
  name = 'FechaEntregaEstimada1792500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ordenes_trabajo" ADD "fecha_entrega_estimada" date`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ordenes_trabajo" DROP COLUMN "fecha_entrega_estimada"`);
  }
}
