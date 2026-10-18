import { MigrationInterface, QueryRunner } from "typeorm";

export class EsquemaInicial1792356007437 implements MigrationInterface {
    name = 'EsquemaInicial1792356007437'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "talleres" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "nombre" character varying(120) NOT NULL, "direccion" character varying(200), "telefono" character varying(30), "activo" boolean NOT NULL DEFAULT true, "nit" character varying(20), "contacto_nombre" character varying(120), "vigente_hasta" date NOT NULL DEFAULT CURRENT_DATE + 15, "motivo_suspension" character varying(200), "notas" text, CONSTRAINT "PK_16bd27c8de7ff35f179c57fcf10" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."usuarios_rol_enum" AS ENUM('SUPERADMIN', 'ADMIN', 'MECANICO')`);
        await queryRunner.query(`CREATE TABLE "usuarios" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "nombre" character varying(120) NOT NULL, "email" character varying(120) NOT NULL, "password_hash" character varying NOT NULL, "rol" "public"."usuarios_rol_enum" NOT NULL DEFAULT 'MECANICO', "activo" boolean NOT NULL DEFAULT true, "taller_id" uuid, CONSTRAINT "UQ_446adfc18b35418aac32ae0b7b5" UNIQUE ("email"), CONSTRAINT "PK_d7281c63c176e152e4c531594a8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "clientes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "taller_id" uuid NOT NULL, "nombre" character varying(120) NOT NULL, "ci_nit" character varying(20), "telefono" character varying(30) NOT NULL, "email" character varying(120), "direccion" character varying(200), "activo" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_d76bf3571d906e4e86470482c08" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9620850e56b84381a1c3ce0488" ON "clientes" ("taller_id", "nombre") `);
        await queryRunner.query(`CREATE TABLE "vehiculos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "taller_id" uuid NOT NULL, "cliente_id" uuid NOT NULL, "placa" character varying(15) NOT NULL, "marca" character varying(50) NOT NULL, "modelo" character varying(50) NOT NULL, "anio" smallint, "color" character varying(30), "nro_chasis" character varying(30), "combustible" character varying(20), "kilometraje" integer NOT NULL DEFAULT '0', "observaciones" text, CONSTRAINT "uq_vehiculo_taller_placa" UNIQUE ("taller_id", "placa"), CONSTRAINT "PK_bc0b75baae377e599cd46b502e1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "sync_operaciones" ("id" uuid NOT NULL, "taller_id" uuid NOT NULL, "usuario_id" uuid NOT NULL, "tipo" character varying(40) NOT NULL, "ok" boolean NOT NULL, "error" text, "creada_en" TIMESTAMP WITH TIME ZONE NOT NULL, "procesada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0eabd03dfccf286d7327d1b05d9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "repuestos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "taller_id" uuid NOT NULL, "codigo" character varying(30) NOT NULL, "nombre" character varying(120) NOT NULL, "marca" character varying(60), "unidad" character varying(15) NOT NULL DEFAULT 'UNIDAD', "stock" numeric(10,2) NOT NULL DEFAULT '0', "stock_minimo" numeric(10,2) NOT NULL DEFAULT '0', "precio_compra" numeric(10,2) NOT NULL DEFAULT '0', "precio_venta" numeric(10,2) NOT NULL DEFAULT '0', "ubicacion" character varying(60), "activo" boolean NOT NULL DEFAULT true, CONSTRAINT "uq_repuesto_taller_codigo" UNIQUE ("taller_id", "codigo"), CONSTRAINT "PK_1f5876d5f0a6dd52f58c191581f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."movimientos_inventario_tipo_enum" AS ENUM('ENTRADA', 'SALIDA', 'DEVOLUCION', 'AJUSTE')`);
        await queryRunner.query(`CREATE TABLE "movimientos_inventario" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "taller_id" uuid NOT NULL, "repuesto_id" uuid NOT NULL, "tipo" "public"."movimientos_inventario_tipo_enum" NOT NULL, "cantidad" numeric(10,2) NOT NULL, "stock_resultante" numeric(10,2) NOT NULL, "orden_id" uuid, "usuario_id" uuid NOT NULL, "motivo" character varying(200), "fecha" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_812f6e4f95b017981363c4b9ff9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d689df10cbaf1e59331cba2d20" ON "movimientos_inventario" ("repuesto_id", "fecha") `);
        await queryRunner.query(`CREATE TYPE "public"."alertas_tipo_enum" AS ENUM('STOCK_BAJO', 'ORDEN_TERMINADA', 'SUSCRIPCION')`);
        await queryRunner.query(`CREATE TABLE "alertas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "taller_id" uuid NOT NULL, "tipo" "public"."alertas_tipo_enum" NOT NULL, "mensaje" character varying(300) NOT NULL, "referencia_id" uuid NOT NULL, "resuelta" boolean NOT NULL DEFAULT false, "resuelta_en" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b474c4021f8d6e4e13383ef1106" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_alerta_abierta" ON "alertas" ("tipo", "referencia_id") WHERE resuelta = false`);
        await queryRunner.query(`CREATE TABLE "servicios" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "taller_id" uuid NOT NULL, "nombre" character varying(120) NOT NULL, "precio" numeric(10,2) NOT NULL, "horas_estimadas" numeric(5,2), "activo" boolean NOT NULL DEFAULT true, CONSTRAINT "uq_servicio_taller_nombre" UNIQUE ("taller_id", "nombre"), CONSTRAINT "PK_fefcdbfeaf506ca485a6dcfb0d8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."orden_historial_estados_estado_anterior_enum" AS ENUM('RECIBIDO', 'EN_DIAGNOSTICO', 'EN_REPARACION', 'TERMINADO', 'ENTREGADO', 'CANCELADO')`);
        await queryRunner.query(`CREATE TYPE "public"."orden_historial_estados_estado_nuevo_enum" AS ENUM('RECIBIDO', 'EN_DIAGNOSTICO', 'EN_REPARACION', 'TERMINADO', 'ENTREGADO', 'CANCELADO')`);
        await queryRunner.query(`CREATE TABLE "orden_historial_estados" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orden_id" uuid NOT NULL, "estado_anterior" "public"."orden_historial_estados_estado_anterior_enum", "estado_nuevo" "public"."orden_historial_estados_estado_nuevo_enum" NOT NULL, "usuario_id" uuid NOT NULL, "comentario" character varying(300), "fecha" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_90e2a4f12d832d4d8f8a9a1bd3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_dc4e9cd4def7b0b01be4d9273d" ON "orden_historial_estados" ("orden_id", "fecha") `);
        await queryRunner.query(`CREATE TABLE "orden_mano_obra" ("id" uuid NOT NULL, "orden_id" uuid NOT NULL, "servicio_id" uuid, "descripcion" character varying(200) NOT NULL, "monto" numeric(10,2) NOT NULL, "mecanico_id" uuid, "usuario_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_715f9af372edc25434cf215da2b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "orden_repuestos" ("id" uuid NOT NULL, "orden_id" uuid NOT NULL, "repuesto_id" uuid NOT NULL, "cantidad" numeric(10,2) NOT NULL, "precio_unitario" numeric(10,2) NOT NULL, "costo_unitario" numeric(10,2) NOT NULL DEFAULT '0', "usuario_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_272d7b795166574ed111572aae4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."ordenes_trabajo_estado_enum" AS ENUM('RECIBIDO', 'EN_DIAGNOSTICO', 'EN_REPARACION', 'TERMINADO', 'ENTREGADO', 'CANCELADO')`);
        await queryRunner.query(`CREATE TABLE "ordenes_trabajo" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "taller_id" uuid NOT NULL, "numero" integer NOT NULL, "vehiculo_id" uuid NOT NULL, "cliente_id" uuid NOT NULL, "mecanico_id" uuid, "creado_por_id" uuid NOT NULL, "estado" "public"."ordenes_trabajo_estado_enum" NOT NULL DEFAULT 'RECIBIDO', "problema_reportado" text NOT NULL, "observaciones_recepcion" text, "diagnostico" text, "kilometraje_ingreso" integer NOT NULL, "sin_repuestos" boolean NOT NULL DEFAULT false, "fecha_ingreso" TIMESTAMP WITH TIME ZONE NOT NULL, "fecha_terminado" TIMESTAMP WITH TIME ZONE, "fecha_entrega" TIMESTAMP WITH TIME ZONE, "descuento" numeric(10,2) NOT NULL DEFAULT '0', CONSTRAINT "uq_orden_taller_numero" UNIQUE ("taller_id", "numero"), CONSTRAINT "PK_5f8d68249311211057d4ab1fbbb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5eac90b6d750e5dd62c0bc9f7f" ON "ordenes_trabajo" ("taller_id", "estado") `);
        await queryRunner.query(`CREATE TYPE "public"."pagos_metodo_enum" AS ENUM('EFECTIVO', 'QR', 'TRANSFERENCIA', 'TARJETA')`);
        await queryRunner.query(`CREATE TABLE "pagos" ("id" uuid NOT NULL, "taller_id" uuid NOT NULL, "orden_id" uuid NOT NULL, "monto" numeric(10,2) NOT NULL, "metodo" "public"."pagos_metodo_enum" NOT NULL DEFAULT 'EFECTIVO', "referencia" character varying(60), "fecha" TIMESTAMP WITH TIME ZONE NOT NULL, "usuario_id" uuid NOT NULL, "anulado" boolean NOT NULL DEFAULT false, "motivo_anulacion" character varying(200), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_37321ca70a2ed50885dc205beb2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1e3b8e4effdc13504776f3e814" ON "pagos" ("taller_id", "fecha") `);
        await queryRunner.query(`CREATE TABLE "pagos_suscripcion" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "taller_id" uuid NOT NULL, "monto" numeric(10,2) NOT NULL, "meses" smallint NOT NULL, "desde" date NOT NULL, "hasta" date NOT NULL, "metodo" character varying(20) NOT NULL, "referencia" character varying(60), "registrado_por_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_dcd170ab606e7a1772a1ceb3796" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a0104118ddecc680a130c42245" ON "pagos_suscripcion" ("taller_id", "created_at") `);
        await queryRunner.query(`ALTER TABLE "usuarios" ADD CONSTRAINT "FK_35910644b106285f94b6b56cf18" FOREIGN KEY ("taller_id") REFERENCES "talleres"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "clientes" ADD CONSTRAINT "FK_e9695fd5b92deda387c55f94617" FOREIGN KEY ("taller_id") REFERENCES "talleres"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vehiculos" ADD CONSTRAINT "FK_0504d1ef2d0cf00c5e77e60fd62" FOREIGN KEY ("taller_id") REFERENCES "talleres"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vehiculos" ADD CONSTRAINT "FK_46e4b6b1f8806acb275970ccacc" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "repuestos" ADD CONSTRAINT "FK_39756b3b51b6d18cb306a9b7564" FOREIGN KEY ("taller_id") REFERENCES "talleres"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "FK_70c542b79172e3f01e53b79bda2" FOREIGN KEY ("repuesto_id") REFERENCES "repuestos"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "FK_c86769588f51c7bbb6bf78ca32b" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orden_historial_estados" ADD CONSTRAINT "FK_d17e211fdd601a6f315b43d1f6c" FOREIGN KEY ("orden_id") REFERENCES "ordenes_trabajo"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orden_historial_estados" ADD CONSTRAINT "FK_c7c7a36f92e26570c25aa7ad016" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orden_mano_obra" ADD CONSTRAINT "FK_cbe8531b264912f8826a24dae8b" FOREIGN KEY ("orden_id") REFERENCES "ordenes_trabajo"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orden_mano_obra" ADD CONSTRAINT "FK_e2b0ff28972bc4a4e7d26ebadf4" FOREIGN KEY ("mecanico_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orden_repuestos" ADD CONSTRAINT "FK_1351276ed3a947da4fd68f9c0c1" FOREIGN KEY ("orden_id") REFERENCES "ordenes_trabajo"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orden_repuestos" ADD CONSTRAINT "FK_47ccfb540c751d6e90ecf7a9263" FOREIGN KEY ("repuesto_id") REFERENCES "repuestos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "FK_624134db97c226b8a1f404899d8" FOREIGN KEY ("taller_id") REFERENCES "talleres"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "FK_d1861ba821e420eb8aba3efa740" FOREIGN KEY ("vehiculo_id") REFERENCES "vehiculos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "FK_020a4958c0b4f44c462a2c43aec" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "FK_3751357ce6745a69dfd4cc59e99" FOREIGN KEY ("mecanico_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pagos" ADD CONSTRAINT "FK_9e64913e6eb4a6bf42053fe3fe4" FOREIGN KEY ("orden_id") REFERENCES "ordenes_trabajo"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pagos" ADD CONSTRAINT "FK_fec62c47394f5abc6ab3e9159cb" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pagos_suscripcion" ADD CONSTRAINT "FK_e7f62f71eaf6166c214ca1a2665" FOREIGN KEY ("taller_id") REFERENCES "talleres"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pagos_suscripcion" ADD CONSTRAINT "FK_1c26ae2420d6e9a92c394e9deac" FOREIGN KEY ("registrado_por_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pagos_suscripcion" DROP CONSTRAINT "FK_1c26ae2420d6e9a92c394e9deac"`);
        await queryRunner.query(`ALTER TABLE "pagos_suscripcion" DROP CONSTRAINT "FK_e7f62f71eaf6166c214ca1a2665"`);
        await queryRunner.query(`ALTER TABLE "pagos" DROP CONSTRAINT "FK_fec62c47394f5abc6ab3e9159cb"`);
        await queryRunner.query(`ALTER TABLE "pagos" DROP CONSTRAINT "FK_9e64913e6eb4a6bf42053fe3fe4"`);
        await queryRunner.query(`ALTER TABLE "ordenes_trabajo" DROP CONSTRAINT "FK_3751357ce6745a69dfd4cc59e99"`);
        await queryRunner.query(`ALTER TABLE "ordenes_trabajo" DROP CONSTRAINT "FK_020a4958c0b4f44c462a2c43aec"`);
        await queryRunner.query(`ALTER TABLE "ordenes_trabajo" DROP CONSTRAINT "FK_d1861ba821e420eb8aba3efa740"`);
        await queryRunner.query(`ALTER TABLE "ordenes_trabajo" DROP CONSTRAINT "FK_624134db97c226b8a1f404899d8"`);
        await queryRunner.query(`ALTER TABLE "orden_repuestos" DROP CONSTRAINT "FK_47ccfb540c751d6e90ecf7a9263"`);
        await queryRunner.query(`ALTER TABLE "orden_repuestos" DROP CONSTRAINT "FK_1351276ed3a947da4fd68f9c0c1"`);
        await queryRunner.query(`ALTER TABLE "orden_mano_obra" DROP CONSTRAINT "FK_e2b0ff28972bc4a4e7d26ebadf4"`);
        await queryRunner.query(`ALTER TABLE "orden_mano_obra" DROP CONSTRAINT "FK_cbe8531b264912f8826a24dae8b"`);
        await queryRunner.query(`ALTER TABLE "orden_historial_estados" DROP CONSTRAINT "FK_c7c7a36f92e26570c25aa7ad016"`);
        await queryRunner.query(`ALTER TABLE "orden_historial_estados" DROP CONSTRAINT "FK_d17e211fdd601a6f315b43d1f6c"`);
        await queryRunner.query(`ALTER TABLE "movimientos_inventario" DROP CONSTRAINT "FK_c86769588f51c7bbb6bf78ca32b"`);
        await queryRunner.query(`ALTER TABLE "movimientos_inventario" DROP CONSTRAINT "FK_70c542b79172e3f01e53b79bda2"`);
        await queryRunner.query(`ALTER TABLE "repuestos" DROP CONSTRAINT "FK_39756b3b51b6d18cb306a9b7564"`);
        await queryRunner.query(`ALTER TABLE "vehiculos" DROP CONSTRAINT "FK_46e4b6b1f8806acb275970ccacc"`);
        await queryRunner.query(`ALTER TABLE "vehiculos" DROP CONSTRAINT "FK_0504d1ef2d0cf00c5e77e60fd62"`);
        await queryRunner.query(`ALTER TABLE "clientes" DROP CONSTRAINT "FK_e9695fd5b92deda387c55f94617"`);
        await queryRunner.query(`ALTER TABLE "usuarios" DROP CONSTRAINT "FK_35910644b106285f94b6b56cf18"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a0104118ddecc680a130c42245"`);
        await queryRunner.query(`DROP TABLE "pagos_suscripcion"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1e3b8e4effdc13504776f3e814"`);
        await queryRunner.query(`DROP TABLE "pagos"`);
        await queryRunner.query(`DROP TYPE "public"."pagos_metodo_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5eac90b6d750e5dd62c0bc9f7f"`);
        await queryRunner.query(`DROP TABLE "ordenes_trabajo"`);
        await queryRunner.query(`DROP TYPE "public"."ordenes_trabajo_estado_enum"`);
        await queryRunner.query(`DROP TABLE "orden_repuestos"`);
        await queryRunner.query(`DROP TABLE "orden_mano_obra"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dc4e9cd4def7b0b01be4d9273d"`);
        await queryRunner.query(`DROP TABLE "orden_historial_estados"`);
        await queryRunner.query(`DROP TYPE "public"."orden_historial_estados_estado_nuevo_enum"`);
        await queryRunner.query(`DROP TYPE "public"."orden_historial_estados_estado_anterior_enum"`);
        await queryRunner.query(`DROP TABLE "servicios"`);
        await queryRunner.query(`DROP INDEX "public"."uq_alerta_abierta"`);
        await queryRunner.query(`DROP TABLE "alertas"`);
        await queryRunner.query(`DROP TYPE "public"."alertas_tipo_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d689df10cbaf1e59331cba2d20"`);
        await queryRunner.query(`DROP TABLE "movimientos_inventario"`);
        await queryRunner.query(`DROP TYPE "public"."movimientos_inventario_tipo_enum"`);
        await queryRunner.query(`DROP TABLE "repuestos"`);
        await queryRunner.query(`DROP TABLE "sync_operaciones"`);
        await queryRunner.query(`DROP TABLE "vehiculos"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9620850e56b84381a1c3ce0488"`);
        await queryRunner.query(`DROP TABLE "clientes"`);
        await queryRunner.query(`DROP TABLE "usuarios"`);
        await queryRunner.query(`DROP TYPE "public"."usuarios_rol_enum"`);
        await queryRunner.query(`DROP TABLE "talleres"`);
    }

}
