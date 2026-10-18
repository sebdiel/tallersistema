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
│       ├── repuestos/  inventario y kardex (HU-12, HU-14)
│       ├── ordenes/    órdenes de trabajo + máquina de estados (HU-09 a HU-13, HU-17)
│       ├── reglas/     motor de reglas por eventos + alertas (RN-12, RN-13)
│       ├── sync/       sincronización offline idempotente (HU-16)
│       ├── servicios/  catálogo de servicios con precio estándar (HU-18)
│       ├── dashboard/  KPIs calculados en SQL (HU-22 a HU-24)
│       ├── common/     guards de rol (HU-03), decoradores, utilidades
│       └── database/   datos iniciales (seed)
├── frontend/           PWA Angular
│   └── src/app/
│       ├── core/       sesión, API, IndexedDB (db.ts), cola offline (sync.service.ts),
│       │               acceso a datos Local-First (datos.service.ts), máquina de estados
│       ├── layout/     barra, menú por rol e indicador de sincronización
│       └── features/   login, inicio, clientes, vehículos, usuarios,
│                       ordenes (+ comprobante), inventario, sync,
│                       dashboard (indicadores), configuracion
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

## Iteración 2: Órdenes de trabajo, inventario y modo offline (OE2)

| HU | Historia | Estado |
|---|---|---|
| HU-09 | Abrir una OT al recibir el vehículo | ✅ |
| HU-10 | Avanzar la OT según la máquina de estados | ✅ |
| HU-11 | Asignar mecánico (el mecánico también puede tomar una OT libre) | ✅ |
| HU-12 | Registrar repuestos, entradas de stock y ajustes por conteo | ✅ |
| HU-13 | Agregar repuestos a la OT con descuento automático de stock | ✅ |
| HU-14 | Alerta de stock bajo el mínimo | ✅ |
| HU-15 | Registrar y trabajar la OT sin internet (IndexedDB) | ✅ |
| HU-16 | Sincronización automática al volver la conexión | ✅ |
| HU-17 | No cerrar una OT sin repuestos registrados ni confirmación | ✅ |

### Máquina de estados de la OT

```
RECIBIDO ─► EN_DIAGNOSTICO ─► EN_REPARACION ─► TERMINADO ─► ENTREGADO
   │              │                 │    ▲           │
   └──────────────┴─────► CANCELADO ◄┘    └───────────┘ (reabrir con motivo)
```

### Reglas de negocio de la iteración

| Código | Regla | Dónde |
|---|---|---|
| RN-06 | Un vehículo solo puede tener una OT abierta | `ordenes.service.ts` (con bloqueo de fila) |
| RN-07 | El kilometraje de ingreso no puede ser menor al último; la OT lo actualiza | `ordenes.service.ts` |
| RN-08 | Solo se permiten las transiciones de la máquina de estados | `maquina-estados.ts` |
| RN-09 | No se pasa a reparación sin diagnóstico; no se diagnostica sin mecánico | `maquina-estados.ts` |
| RN-10 | Usar un repuesto descuenta stock; nunca queda negativo (UPDATE atómico) | `repuestos.service.ts → moverStock` |
| RN-11 | No se termina una OT sin repuestos registrados o confirmación de "sin repuestos" | `maquina-estados.ts` |
| RN-12 | Alerta automática de stock mínimo, que se resuelve sola al reponer | `reglas/reglas.listener.ts` |
| RN-13 | Al terminar una OT se genera el aviso "avisar al cliente" | `reglas/reglas.listener.ts` |
| RN-14 | Cancelar una OT (con motivo) devuelve los repuestos al inventario | `ordenes.service.ts` |

### Cómo funciona el modo offline (Local-First)

1. Al entrar, el dispositivo descarga una copia de los datos del taller (`GET /api/sync/snapshot`) en IndexedDB.
2. Cada cambio en una OT se valida en el dispositivo (las mismas reglas que el servidor), se aplica en la copia local y se guarda en una **cola de operaciones**.
3. Con conexión, la cola se envía al instante (`POST /api/sync`). Sin conexión, espera y se envía sola al volver internet.
4. El servidor procesa cada operación **una sola vez**: tiene un id único y reenviarla no duplica nada. Si una operación ya no cumple una regla al llegar (por ejemplo, otro usuario usó el último repuesto), se informa como **conflicto** en la pantalla *Sincronización*.
5. Se conserva la hora real en la que se hizo cada cambio en el dispositivo. Los KPIs de tiempo de la Iteración 3 dependen de ese dato.

> El modo offline completo (abrir la app sin internet) requiere el build de producción, porque en `ng serve` el Service Worker está desactivado.

### Pruebas realizadas

- **Unitarias** (`npm test` en backend): máquina de estados y normalización de placa (10 pruebas).
- **API de punta a punta**: 33 comprobaciones del flujo completo: inventario, OT, reglas RN-06 a RN-14, alertas, sincronización idempotente y conflictos.
- **Navegador real con PWA de producción** (Edge sin interfaz, 412 px de ancho): recibir un vehículo y un cliente nuevos sin internet, diagnosticar, cargar repuestos, recargar la app sin conexión, volver a tener conexión y comprobar que el servidor confirma todo (15 comprobaciones).

## Iteración 3: Costos, pagos y dashboard de KPIs (OE3)

| HU | Historia | Estado |
|---|---|---|
| HU-18 | Registrar mano de obra, libre o desde un **catálogo de servicios con precio estándar** | ✅ |
| HU-19 | Cálculo automático del costo total (repuestos + mano de obra − descuento) | ✅ |
| HU-20 | Comprobante / presupuesto imprimible o en PDF ("No válido como factura") | ✅ |
| HU-21 | Registrar pagos totales, parciales o adelantos (efectivo, QR, transferencia, tarjeta) | ✅ (también sin conexión) |
| HU-22 | Dashboard: ingresos, OT entregadas, ticket promedio, tiempo de reparación, cumplimiento, reaperturas, margen | ✅ |
| HU-23 | KPIs de inventario: repuestos más vendidos, cobertura en días, valor del inventario, repuestos sin salida | ✅ |
| HU-24 | Filtro por período (7 días, 30 días, mes, mes anterior, año o rango libre) con comparación contra el período anterior | ✅ |

### Reglas de negocio de la iteración

| Código | Regla | Dónde |
|---|---|---|
| RN-15 | El total se calcula siempre igual en servidor y dispositivo; los precios se congelan al registrar cada línea | `ordenes/costos.ts` (y su copia en `frontend/core/costos.ts`) |
| RN-16 | Solo el administrador aplica descuentos, y nunca mayores al subtotal | `ordenes.service.ts → aplicarDescuento` |
| RN-17 | Ningún pago supera el saldo; ningún descuento o quitar un cargo deja el total por debajo de lo ya pagado | `ordenes.service.ts` |
| RN-18 | No se entrega con saldo pendiente, salvo **entrega a crédito** autorizada por el administrador con comentario | `maquina-estados.ts` |
| RN-19 | No se cancela una OT con pagos vigentes; los pagos no se borran, se **anulan con motivo** | `maquina-estados.ts`, `anularPago` |
| RN-20 | Mano de obra, descuento y cobros se editan mientras la OT está abierta; tras entregar, los costos quedan cerrados | `ordenes.service.ts → verificarEstadoCostos` |

### Indicadores (cómo se calculan)

| KPI | Cálculo |
|---|---|
| Ingresos cobrados | Σ pagos no anulados en el período (hora de Bolivia) |
| Ticket promedio | Facturado de las OT entregadas ÷ cantidad de OT entregadas |
| Tiempo promedio de reparación | Promedio de (fecha terminado − fecha ingreso) |
| Tiempo por etapa | Promedio del tiempo entre cada cambio de estado (historial), para detectar cuellos de botella |
| Cumplimiento | % de OT recibidas en el período que ya fueron entregadas |
| Reaperturas (retrabajo) | % de OT terminadas que se reabrieron (TERMINADO → EN_REPARACION) |
| Margen en repuestos | Σ cantidad × (precio de venta − precio de compra) congelados en la OT |
| Cobertura de stock | Stock actual ÷ consumo diario promedio del período |
| Cuentas por cobrar | Saldo de las OT terminadas o entregadas con deuda |

Cada indicador se compara con el período anterior de igual duración (▲/▼ en %). El dashboard es solo para el administrador y requiere conexión (se calcula en el servidor).

### Pruebas realizadas

- **Unitarias** (`npm test` en backend): 15 pruebas (costos, máquina de estados con RN-18/RN-19, placas).
- **API de punta a punta**: 34 comprobaciones de catálogo, costos, descuentos, pagos, crédito, anulación, sincronización de cobros offline y dashboard.
- **Navegador real con la PWA de producción**: cargar mano de obra desde el catálogo, descuento, pago por QR, **cobro sin conexión** que se sincroniza solo, entrega, comprobante, dashboard y configuración (16 comprobaciones). También se repitió la prueba offline de la Iteración 2, sin regresiones.
