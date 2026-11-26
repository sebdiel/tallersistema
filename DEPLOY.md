# Despliegue en producción (VPS)

Guía para poner TallerPro en internet con HTTPS en un servidor VPS. Esto corresponde a la HU-29 de la Iteración 4.

## Qué se instala

```
Internet ──HTTPS──► Caddy (web)  ──► PWA Angular (archivos estáticos)
                        │
                        └─/api──► NestJS (backend) ──► PostgreSQL (db)
                                                         ▲
                                     backup (pg_dump diario)┘
```

| Servicio | Imagen | Función |
|---|---|---|
| `web` | Caddy 2 + build de Angular | Sirve la PWA, obtiene y renueva solo el certificado HTTPS (Let's Encrypt) y redirige `/api` al backend |
| `backend` | Node 20 + NestJS | API REST. Aplica las migraciones pendientes al arrancar |
| `db` | PostgreSQL 16 | Base de datos. **No** expone puertos a internet |
| `backup` | PostgreSQL 16 | `pg_dump` diario en `./backups`, conserva 14 días |

## Requisitos

- Un VPS con Ubuntu 22.04 o 24.04 y al menos 2 GB de RAM. Por ejemplo Hetzner CX22 o DigitalOcean (Bs ~50/mes, ver factibilidad económica).
- Un dominio, por ejemplo `taller.midominio.com`, con un **registro DNS tipo A** que apunte a la IP del VPS.
- Los puertos 80 y 443 abiertos.

## 1. Preparar el servidor (una sola vez)

```bash
ssh root@IP_DEL_VPS

# Docker oficial
curl -fsSL https://get.docker.com | sh

# Firewall: solo SSH, HTTP y HTTPS
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

## 2. Descargar el proyecto y configurarlo

```bash
git clone https://github.com/sebdiel/tallersistema.git
cd tallersistema
cp .env.prod.example .env.prod
nano .env.prod
```

En `.env.prod` complete:

| Variable | Cómo obtenerla |
|---|---|
| `DOMAIN` | Su dominio (ya apuntando al VPS) |
| `ACME_EMAIL` | Su correo, para los avisos de Let's Encrypt |
| `POSTGRES_PASSWORD` | `openssl rand -base64 24` |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD` | Su usuario SUPERADMIN inicial |

> `.env.prod` contiene secretos: está en `.gitignore` y **nunca** debe subirse a GitHub.

## 3. Levantar el sistema

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

El primer arranque tarda unos minutos, porque compila Angular y NestJS. Para comprobar:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps        # todos "running"
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f backend
curl https://taller.midominio.com/api/health                             # {"status":"ok",...}
```

Luego abra `https://taller.midominio.com`, ingrese con el SUPERADMIN y cree el primer taller desde **Talleres → + Nuevo taller**.

## 4. Actualizar a una nueva versión

```bash
cd tallersistema
git pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

- Si hay cambios en la base de datos, las **migraciones** se aplican solas al reiniciar el backend.
- Los usuarios reciben la nueva versión de la PWA automáticamente (Service Worker).

### Cambios en la base de datos (desarrollo)

En desarrollo (`DB_SYNC=true`) las tablas siguen a las entidades. Antes de desplegar un cambio de esquema hay que generar la migración:

```bash
cd backend
npm run typeorm -- migration:generate src/database/migraciones/DescripcionDelCambio
git add src/database/migraciones && git commit -m "Migración: DescripcionDelCambio"
```

## 5. Copias de seguridad

- Se hace un respaldo automático al arrancar y luego cada 24 horas en `./backups/taller_AAAAMMDD_HHMMSS.dump`. La retención predeterminada es de 14 días.
- **Recomendado:** copiar los respaldos fuera del VPS. Por ejemplo, con `rclone` a Backblaze B2 o Google Drive mediante un cron diario:
  ```bash
  0 4 * * * rclone copy /root/tallersistema/backups remoto:tallerpro-backups
  ```
- Para restaurar un respaldo (reemplaza los datos actuales):
  ```bash
  sh ./deploy/restaurar.sh backups/taller_20261018_0300.dump
  ```

El script comprueba que el archivo se pueda leer antes de detener la API y pide
escribir `RESTAURAR`. Ejecuta `pg_restore` con `--exit-on-error` y
`--single-transaction`: ante un error, los cambios de la restauración se revierten.
También intenta arrancar la API al salir, incluso si la restauración falla.

## 6. Seguridad aplicada

| Medida | Dónde |
|---|---|
| HTTPS obligatorio (HTTP redirige a HTTPS) y HSTS | Caddy |
| Base de datos sin puertos públicos | `docker-compose.prod.yml` |
| Contraseñas con bcrypt; sesiones JWT con expiración | Backend |
| Máximo 5 intentos de login por minuto por IP (fuerza bruta) | `auth.controller.ts` (ThrottlerGuard) |
| Validación de toda entrada (`whitelist`, `forbidNonWhitelisted`) | `main.ts` |
| Aislamiento por taller en todas las consultas | `tallerDe()` en cada servicio |
| Contenedor de la API con usuario sin privilegios | `backend/Dockerfile` |
| Cabeceras: `X-Frame-Options`, `nosniff`, `Referrer-Policy` | `frontend/Caddyfile` |

## 7. Comandos útiles

```bash
C="docker compose --env-file .env.prod -f docker-compose.prod.yml"
$C logs -f backend               # registros de la API
$C restart backend               # reiniciar la API
$C exec db psql -U taller taller_db   # consola SQL
$C down                          # detener (los datos se conservan en volúmenes)
```

## Prueba local del stack de producción

Se puede levantar el mismo stack en una PC con Docker Desktop usando `DOMAIN=localhost`. Caddy genera un certificado local y el navegador mostrará una advertencia de certificado. Para no ocupar los puertos 80 y 443, defina por ejemplo `HTTP_PORT=8081` y `HTTPS_PORT=8443` en el archivo de entorno.

El navegador necesita confiar en el certificado para registrar el Service Worker
sobre HTTPS. Para probar el modo offline sin configurar certificados, el comando
`npm.cmd run test:pwa` dentro de `backend` publica una PWA de prueba sobre HTTP en
la dirección de loopback, que el navegador permite como contexto seguro.

## Validación automática aislada del despliegue

Con Docker Desktop encendido y Node.js instalado, desde la raíz del repositorio:

```powershell
node deploy/test-produccion.cjs
```

El comando utiliza `docker-compose.prod.yml` con un proyecto temporal independiente,
credenciales aleatorias y puertos publicados únicamente en `127.0.0.1`. No lee
`.env.prod`, no utiliza los volúmenes del taller y guarda sus backups en una carpeta
temporal. La primera ejecución descarga dependencias y construye ambas imágenes.

Comprueba:

- HTTPS de Caddy con certificado local y redirección desde HTTP.
- API a través de Caddy, rutas de Angular, manifiesto PWA y cabeceras de seguridad.
- Caché de un año para JS/CSS con hash y `no-cache` para el manifiesto del Service Worker.
- PostgreSQL sin puerto público y backend ejecutándose sin usuario root.
- Todas las migraciones aplicadas automáticamente sobre una base vacía.
- Alta de un taller, cliente, vehículo y orden con un adelanto de Bs 50 por la API.
- Creación de un respaldo con el servicio `backup` real.
- Restauración transaccional en otra base de prueba y comparación de cantidades,
  identificadores, motivo, costo estimado, placa, cliente y pago.

Verificado el 25/11/2026: todas estas comprobaciones aprobaron con **6 migraciones**.
La verificación HTTPS acepta el certificado local exclusivamente en este script.
No verifica DNS, certificado público, firewall ni disponibilidad de un VPS real;
esas comprobaciones corresponden al momento de publicar el sistema.

Al finalizar se eliminan los contenedores, volúmenes y archivos temporales de este
proyecto de pruebas. Las imágenes construidas quedan disponibles en Docker.
