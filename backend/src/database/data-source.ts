import 'dotenv/config';
import { join } from 'path';
import { DataSource } from 'typeorm';

/**
 * Configuración para la CLI de TypeORM (generar y ejecutar migraciones).
 * La aplicación usa la misma conexión desde app.module.ts.
 *
 *   npm run typeorm -- migration:generate src/database/migraciones/AgregarCampoX
 *   npm run migracion:ejecutar
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migraciones', '*.{ts,js}')],
});
