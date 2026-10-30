import { MigrationInterface, QueryRunner } from 'typeorm';

/** RN-28: repuestos que trae el cliente o que el taller compra afuera. */
export class RepuestosExternos1792700000000 implements MigrationInterface {
  name = 'RepuestosExternos1792700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "orden_repuestos_externos" (
      "id" uuid NOT NULL,
      "orden_id" uuid NOT NULL,
      "descripcion" character varying(200) NOT NULL,
      "cantidad" numeric(10,2) NOT NULL,
      "origen" character varying(10) NOT NULL,
      "costo_unitario" numeric(10,2),
      "precio_unitario" numeric(10,2) NOT NULL,
      "usuario_id" uuid NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_orden_repuestos_externos" PRIMARY KEY ("id"),
      CONSTRAINT "FK_orden_repuestos_externos_orden" FOREIGN KEY ("orden_id")
        REFERENCES "ordenes_trabajo"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE INDEX "IDX_orden_repuestos_externos_orden" ON "orden_repuestos_externos" ("orden_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "orden_repuestos_externos"`);
  }
}
