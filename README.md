# TallerPro — Sistema Web Progresivo para talleres mecánicos

Proyecto de Grado — Ingeniería de Sistemas, UAB.
Sistema web progresivo basado en reglas de negocio automatizadas para la gestión operativa de talleres mecánicos de microempresas en Cochabamba.

| Capa | Tecnología |
|---|---|
| Frontend | Angular 18 + `@angular/pwa` (Service Worker) |
| Backend | NestJS 10 (API REST, JWT, roles) |
| Base de datos | PostgreSQL 16 (Docker) + TypeORM |

```
tallersistema/
├── backend/            API NestJS
│   └── src/
│       ├── auth/       login JWT (HU-01)
│       ├── usuarios/   gestión de personal (HU-02)
│       ├── clientes/   registro y búsqueda (HU-04, HU-05)
│       ├── vehiculos/  ficha técnica e historial (HU-06, HU-07)
│       ├── talleres/   entidad multi-taller (base para Iteración 4)
│       ├── common/     guards de rol (HU-03), decoradores, utilidades
│       └── database/   datos iniciales (seed)
├── frontend/           PWA Angular
│   └── src/app/
│       ├── core/       sesión, interceptor, guards, servicios API
│       ├── layout/     barra y menú por rol
│       └── features/   login, inicio, clientes, vehículos, usuarios
└── docker-compose.yml  PostgreSQL 16
```

## Cómo ejecutar (desarrollo)

Requisitos: Node 20+, Docker Desktop abierto.

```bash
# 1. Base de datos
docker compose up -d

# 2. Backend  →  http://localhost:3000/api
cd backend
cp .env.example .env      # solo la primera vez
npm install
npm run start:dev

# 3. Frontend  →  http://localhost:4200
cd frontend
npm install
npm start
```

Al primer arranque el backend crea automáticamente:

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador del taller | `admin@taller.bo` | `Admin123` |
| Super administrador | `superadmin@taller.bo` | `SuperAdmin123` |

Pruebas unitarias del backend: `cd backend && npm test`.

Para probar la PWA instalable y el Service Worker hay que usar el build de producción (`ng build`), porque en `ng serve` el Service Worker está desactivado.

## Iteración 1: Usuarios, clientes y vehículos (OE1)

| HU | Historia | Estado |
|---|---|---|
| HU-01 | Iniciar sesión con correo y contraseña | ✅ |
| HU-02 | El administrador gestiona mecánicos (crear, editar, desactivar) | ✅ |
| HU-03 | Acceso restringido por rol (backend y menú) | ✅ |
| HU-04 | Registrar clientes | ✅ |
| HU-05 | Buscar clientes por nombre, CI/NIT o teléfono | ✅ |
| HU-06 | Registrar vehículos vinculados a un cliente | ✅ |
| HU-07 | Buscar por placa y ver la ficha técnica del vehículo | ✅ (el historial se llena en la Iteración 2) |
| HU-08 | Instalar como PWA | ✅ (manifest + Service Worker) |

### Reglas de negocio implementadas

| Código | Regla | Dónde |
|---|---|---|
| RN-01 | La placa es única por taller y se normaliza (`2345 abc` → `2345ABC`) | `vehiculos.service.ts`, `placa.util.ts` |
| RN-02 | Solo el ADMIN gestiona usuarios | `@Roles(Rol.ADMIN)` en `usuarios.controller.ts` |
| RN-03 | Un usuario desactivado no puede ingresar y su sesión se corta de inmediato | `auth.service.ts`, `jwt.strategy.ts` |
| RN-04 | Un cliente con vehículos no se elimina, solo se desactiva | `clientes.service.ts` |
| RN-05 | El kilometraje de un vehículo no puede disminuir | `vehiculos.service.ts` |

### Decisiones de diseño para las siguientes iteraciones

- **Multi-taller desde el inicio:** todas las tablas operativas tienen `taller_id` y cada consulta se filtra por el taller del usuario. La Iteración 4 (SuperAdmin y suscripciones) no requiere rehacer el modelo.
- **UUID como clave primaria:** permite crear registros offline en IndexedDB (Iteración 2) sin choques de id al sincronizar.
- **`DB_SYNC=true` solo en desarrollo:** antes del despliegue en el VPS (Iteración 4) se reemplaza por migraciones de TypeORM.
