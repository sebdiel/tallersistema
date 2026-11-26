# MotoraApp — Sistema Web Progresivo para talleres mecánicos

Proyecto de Grado — Ingeniería de Sistemas, UAB.
Sistema basado en reglas de negocio para la gestión operativa de talleres mecánicos de microempresas en Cochabamba.

Estado revisado el **25/11/2026**. «TallerPro» es el nombre anterior; algunos identificadores internos, como la base IndexedDB `tallerpro`, conservan ese nombre para mantener los datos existentes.

## Funciones actuales

- Clientes y vehículos con ficha e historial, incluido combustible GASOLINA/GNV.
- Recepción con motivo de ingreso, kilometraje, costo estimado opcional y fecha estimada de entrega.
- Calendario de entregas en Inicio, días ocupados y órdenes atrasadas.
- Detalle de órdenes por etapas, asignación de mecánico y diagnóstico documentado.
- Inventario con movimientos y descuento de stock; repuestos externos aportados por el cliente o del taller fuera del inventario.
- Mano de obra desde catálogo o trabajo libre, costos separados y edición de precios con motivo después del presupuesto.
- Presupuestos y comprobantes imprimibles; el comprobante no es factura fiscal del SIN.
- Adelantos, pagos parciales, descuentos del administrador y entrega a crédito con comentario.
- Notificaciones con contador y enlace de WhatsApp en Terminado: el operador revisa y envía el mensaje.
- Indicadores para el administrador, gestión de talleres y suscripciones para el SuperAdmin.
- PWA con Service Worker, IndexedDB/Dexie y cola de sincronización, temas claro e industrial.

## Tecnología y estructura

| Capa | Implementación |
|---|---|
| Interfaz | Angular 18, componentes standalone, señales, Chart.js |
| Trabajo offline | Service Worker de Angular e IndexedDB con Dexie |
| API | NestJS 10, TypeORM, JWT, bcrypt y validación de DTO |
| Datos | PostgreSQL 16; 6 migraciones versionadas |
| Producción | Docker Compose, Caddy HTTPS y pg_dump/pg_restore |
| Pruebas | Jest/Supertest, Karma/Jasmine y Playwright |

- `backend/src`: autenticación, usuarios, clientes, vehículos, órdenes, inventario, reglas, sync, dashboard, suscripciones y migraciones.
- `backend/test`: integración HTTP y recorrido PWA aislados.
- `frontend/src/app`: interfaz, sesión, datos locales, sincronización y componentes.
- `frontend/test`: ejecución de las pruebas de componentes en Chrome/Edge.
- `deploy`: respaldo, restauración y prueba aislada de producción.
- `docs`: actualización técnica para incorporar a la tesis.

## Ejecutar en desarrollo

Requiere Node.js, npm y Docker Desktop. El compose de desarrollo utiliza PostgreSQL en el puerto 5432.

Primera terminal, desde la raíz:

```powershell
docker compose up -d
cd backend
# Solo si todavía no existe .env:
Copy-Item .env.example .env
npm.cmd ci
npm.cmd run start:dev
```

Segunda terminal, desde la raíz:

```powershell
cd frontend
npm.cmd ci
npm.cmd start
```

Abrir http://localhost:4200. La API se publica en http://localhost:3000/api.
No reemplace un archivo `.env` ya configurado. En desarrollo, las credenciales de demostración se definen en `backend/.env.example`; en producción deben configurarse credenciales propias, sin taller demo.

El Service Worker está desactivado en `ng serve`. Para verificar offline use el comando de prueba PWA indicado más abajo.

## Flujo de una orden

| Estado | Trabajo principal |
|---|---|
| RECIBIDO | Revisar recepción, asignar mecánico y registrar adelanto si corresponde. |
| EN_DIAGNOSTICO | Documentar la falla y armar el presupuesto con repuestos y mano de obra. |
| EN_REPARACION | Ejecutar el trabajo y corregir cargos con motivo si existe presupuesto guardado. |
| TERMINADO | Avisar al cliente, cobrar el saldo y preparar la entrega. |
| ENTREGADO | Consultar el registro cerrado; si hubo entrega a crédito, registrar el cobro pendiente. |

Antes de terminar se puede cancelar con motivo y sin pagos vigentes. Los repuestos del inventario se devuelven. Desde TERMINADO se puede reabrir EN_REPARACION con motivo. Actualmente no existe la transición EN_REPARACION → EN_DIAGNOSTICO.

El presupuesto guardado conserva el monto al iniciar Reparación y permite comparar diferencias. No constituye una firma ni una constancia de aprobación del cliente: el registro del medio de aprobación fue retirado.

### Repuestos y pagos

- Inventario: descuenta stock y conserva el precio registrado en la línea.
- Externo del cliente: se registra con precio cero; la instalación se cobra como mano de obra.
- Externo del taller: se cobra sin descontar inventario y puede registrar costo de compra.
- Total = repuestos del inventario + repuestos externos cobrables + mano de obra − descuento.
- En Recibido y Diagnóstico se permiten adelantos aunque no haya cargos suficientes todavía. Desde Reparación el pago no puede superar el saldo.
- No se permite terminar o entregar con sobrepago. La entrega con deuda requiere administrador y comentario.

## Suscripciones

Modelo SaaS con un plan único; precio de referencia configurable mediante `PRECIO_SUSCRIPCION` (Bs 90/mes por defecto). La prueba inicial predeterminada es de 15 días. El SuperAdmin registra los pagos manualmente; no hay pasarela automática ni planes Básico/Gold implementados.

| Estado | Condición | Acceso |
|---|---|---|
| ACTIVA | Faltan más de 7 días | Habilitado |
| POR_VENCER | Faltan entre 0 y 7 días | Habilitado con aviso |
| EN_GRACIA | Entre 1 y 5 días después de vencer | Habilitado con aviso |
| VENCIDA | Más de 5 días después de vencer | Bloqueado |
| SUSPENDIDA | Suspensión manual | Bloqueado |

## Historias de usuario de las cuatro iteraciones originales

Se conserva la numeración HU-01 a HU-29. Las ampliaciones posteriores se describen en las funciones actuales; no se presentan como historias adicionales ya aprobadas por el tutor.

| HU | Historia | Estado |
|---|---|---|
| HU-01 | Iniciar sesión con correo y contraseña | ✅ |
| HU-02 | El administrador gestiona mecánicos (crear, editar, desactivar) | ✅ |
| HU-03 | Acceso restringido por rol (backend y menú) | ✅ |
| HU-04 | Registrar clientes | ✅ |
| HU-05 | Buscar clientes por nombre, CI/NIT o teléfono | ✅ |
| HU-06 | Registrar vehículos vinculados a un cliente | ✅ |
| HU-07 | Buscar por placa y ver la ficha técnica del vehículo | ✅ Historial implementado |
| HU-08 | Instalar como PWA | ✅ (manifest + Service Worker) |
| HU-09 | Abrir una OT al recibir el vehículo | ✅ |
| HU-10 | Avanzar la OT según la máquina de estados | ✅ |
| HU-11 | Asignar mecánico (el mecánico también puede tomar una OT libre) | ✅ |
| HU-12 | Registrar repuestos, entradas de stock y ajustes por conteo | ✅ |
| HU-13 | Agregar repuestos a la OT con descuento automático de stock | ✅ |
| HU-14 | Alerta de stock bajo el mínimo | ✅ |
| HU-15 | Registrar y trabajar la OT sin internet (IndexedDB) | ✅ |
| HU-16 | Sincronización automática al volver la conexión | ✅ |
| HU-17 | No cerrar una OT sin repuestos registrados ni confirmación | ✅ |
| HU-18 | Registrar mano de obra, libre o desde un **catálogo de servicios con precio estándar** | ✅ |
| HU-19 | Cálculo automático del costo total (repuestos + mano de obra − descuento) | ✅ |
| HU-20 | Comprobante / presupuesto imprimible o en PDF ("No válido como factura") | ✅ |
| HU-21 | Registrar pagos totales, parciales o adelantos (efectivo, QR, transferencia, tarjeta) | ✅ (también sin conexión) |
| HU-22 | Dashboard: ingresos, OT entregadas, ticket promedio, tiempo de reparación, cumplimiento, reaperturas, margen | ✅ |
| HU-23 | KPIs de inventario: repuestos más vendidos, cobertura en días, valor del inventario, repuestos sin salida | ✅ |
| HU-24 | Filtro por período (7 días, 30 días, mes, mes anterior, año o rango libre) con comparación contra el período anterior | ✅ |
| HU-25 | El SUPERADMIN registra talleres con su administrador y días de prueba | ✅ |
| HU-26 | Gestionar suscripciones: registrar pagos, suspender y reactivar, restablecer contraseñas | ✅ |
| HU-27 | Bloqueo automático por vencimiento, con período de gracia y avisos programados | ✅ |
| HU-28 | Panel global: talleres por estado, ingreso recurrente, cobros por mes, cobranza pendiente y uso por taller | ✅ |
| HU-29 | Despliegue en VPS con HTTPS, migraciones y backups automáticos | ✅ Listo y probado localmente (ver [DEPLOY.md](DEPLOY.md)) |

## Reglas de negocio documentadas

| Código | Regla | Implementación |
|---|---|---|
| RN-01 | La placa es única por taller y se normaliza (`2345 abc` → `2345ABC`) | `vehiculos.service.ts`, `placa.util.ts` |
| RN-02 | Solo el ADMIN gestiona usuarios | `@Roles(Rol.ADMIN)` en `usuarios.controller.ts` |
| RN-03 | Un usuario desactivado no puede ingresar y su sesión se corta de inmediato | `auth.service.ts`, `jwt.strategy.ts` |
| RN-04 | Un cliente con vehículos no se elimina, solo se desactiva | `clientes.service.ts` |
| RN-05 | El kilometraje de un vehículo no puede disminuir | `vehiculos.service.ts` |
| RN-06 | Un vehículo solo puede tener una OT abierta | `ordenes.service.ts` (con bloqueo de fila) |
| RN-07 | El kilometraje de ingreso no puede ser menor al último; la OT lo actualiza | `ordenes.service.ts` |
| RN-08 | Solo se permiten las transiciones de la máquina de estados | `maquina-estados.ts` |
| RN-09 | No se pasa a reparación sin diagnóstico; no se diagnostica sin mecánico | `maquina-estados.ts` |
| RN-10 | Usar un repuesto descuenta stock; nunca queda negativo (UPDATE atómico) | `repuestos.service.ts → moverStock` |
| RN-11 | No se termina una OT sin repuestos registrados o confirmación de "sin repuestos" | `maquina-estados.ts` |
| RN-12 | Alerta automática de stock mínimo, que se resuelve sola al reponer | `reglas/reglas.listener.ts` |
| RN-13 | Al terminar una OT se genera el aviso "avisar al cliente" | `reglas/reglas.listener.ts` |
| RN-14 | Cancelar una OT (con motivo) devuelve los repuestos al inventario | `ordenes.service.ts` |
| RN-15 | El total se calcula siempre igual en servidor y dispositivo; los precios se congelan al registrar cada línea | `ordenes/costos.ts` (y su copia en `frontend/core/costos.ts`) |
| RN-16 | Solo el administrador aplica descuentos, y nunca mayores al subtotal | `ordenes.service.ts → aplicarDescuento` |
| RN-17 | Los pagos respetan el saldo, excepto adelantos en Recibido/Diagnóstico; descuentos y bajas de cargos respetan lo ya cobrado | `ordenes.service.ts` |
| RN-18 | No se entrega con saldo pendiente, salvo **entrega a crédito** autorizada por el administrador con comentario | `maquina-estados.ts` |
| RN-19 | No se cancela una OT con pagos vigentes; los pagos no se borran, se **anulan con motivo** | `maquina-estados.ts`, `anularPago` |
| RN-20 | Mano de obra, descuento y cobros se editan mientras la OT está abierta; tras entregar, los costos quedan cerrados | `ordenes.service.ts → verificarEstadoCostos` |
| RN-21 | Durante 5 días de gracia tras vencer, el taller sigue trabajando con un aviso visible | `admin/suscripcion.ts` |
| RN-22 | Vencida o suspendida: se bloquea el login **y se cortan las sesiones abiertas**, explicando el motivo | `auth.service.ts`, `jwt.strategy.ts` |
| RN-23 | Un pago extiende desde el vencimiento si aún no venció (no se pierden días) o desde hoy si ya venció | `admin/suscripcion.ts → nuevaVigencia` |
| RN-24 | Todos los días a las 07:00 (hora de Bolivia) se avisa a los talleres por vencer o en gracia; el aviso se cierra solo al pagar | `admin/suscripciones.tareas.ts` (@Cron) |
| RN-25 | El SUPERADMIN solo ve cifras de uso de cada taller, nunca sus clientes ni sus órdenes | `admin.service.ts` |
| RN-26 | Fecha estimada no anterior a recepción | DTO, servicio de órdenes y calendario |
| RN-27 | Costo estimado opcional y no negativo | DTO y recepción |
| RN-28 | Repuesto externo no afecta stock; si lo aporta el cliente, precio cero | Entidad y servicio de órdenes |
| RN-29 | Presupuesto guardado y motivo al editar precios posteriormente | Servicio, datos locales y detalle |
| RN-30 | Adelantos en etapas iniciales; no terminar ni entregar con sobrepago | Pagos y máquina de estados |

La asignación de mecánico está en el detalle de la orden. Las propuestas retiradas (aprobación por medio y retroceso a Diagnóstico) no se consideran funciones vigentes.

## Pruebas reproducibles del flujo de órdenes

Con Docker encendido y las dependencias del backend instaladas:

```powershell
cd backend
npm.cmd test -- --runInBand
npm.cmd run test:e2e
```

`test:e2e` crea un PostgreSQL 16 temporal, sin volúmenes y con puerto local aleatorio.
Genera credenciales exclusivas, aplica todas las migraciones sobre una base vacía,
inicia la API de pruebas y elimina el contenedor al finalizar. No utiliza las
credenciales ni los datos del taller. La primera ejecución puede descargar la imagen
`postgres:16-alpine`.

La suite HTTP comprueba autenticación, recepción de cliente y vehículo, rechazo de
órdenes duplicadas, adelantos, asignación, diagnóstico obligatorio, descuento de
stock, repuestos externos, mano de obra, presupuesto conservado, motivo obligatorio
al editar precios, rechazo de sobrepagos, cobro y cierre de la orden.
Verificación del 25/11/2026: **34 pruebas unitarias y 8 pruebas de integración aprobadas**.
Estas pruebas no sustituyen las pruebas de pantallas ni las del funcionamiento offline.

### Pruebas de formularios y permisos del frontend

```powershell
cd frontend
npm.cmd run test:ci
```

Ejecuta **20 pruebas en Chrome sin interfaz** (Karma/Jasmine), con datos simulados:
recepción, validación de cliente y vehículo, confirmación de fecha ocupada,
visibilidad por etapa, ventanas de costos, selección de servicios, manejo de errores
de stock, descuento por rol, acceso a rutas y enlace de WhatsApp. El comando busca
Chrome o Edge en Windows; se puede indicar otra ubicación mediante `CHROME_BIN`.
No necesita una API encendida y no modifica la base del taller. No envía mensajes.
Verificación del 25/11/2026: **20 aprobadas**. Estas son pruebas de componentes y
guards, no una revisión visual manual ni una prueba de la PWA sin conexión.

### Prueba de la PWA sin conexión

Con Docker y Chrome/Edge disponibles, y las dependencias de ambas carpetas instaladas:

```powershell
cd backend
npm.cmd run test:pwa
```

Para practicar con una ventana visible de Chrome y datos temporales:

```powershell
npm.cmd run test:pwa:manual
```

El comando abre una sesión de prueba y espera a que termine la precarga offline.
Después permite usar F12 → Network → Offline, registrar cambios, recargar y volver
a No throttling para sincronizar. La dirección manual es http://127.0.0.1:8080
(puede cambiarse con PWA_TEST_PORT). Cerrar Chrome no apaga el servidor: mantenga
la terminal abierta y presione Enter allí cuando termine para eliminar los datos temporales. El enlace es local a
esta computadora; no permite probar directamente desde un celular.

Usa Playwright con un perfil temporal de Chrome y PostgreSQL desechable. Compila
Angular con `production,pwa-test` (Service Worker real; solo se desactiva la descarga
de fuentes de Google durante la compilación). Publica frontend y API en puertos
locales aleatorios y espera la precarga completa de los módulos de la aplicación.

El recorrido comprueba inicio de sesión y descarga inicial, creación de una orden
offline, asignación, diagnóstico, repuesto con descuento local de stock, mano de
obra y pago. Cierra completamente Chrome, lo reabre sin conexión con el mismo
perfil y verifica que conserva la orden y las 8 operaciones pendientes. Después
reconecta, comprueba total Bs 170, pagado Bs 50 y saldo Bs 120, y reenvía las mismas
operaciones para verificar que no duplica la orden, cargos, pago ni salida de stock.
Los recursos de prueba se eliminan al terminar; no se usan los datos del taller.

Verificado el 25/11/2026 en Chrome de escritorio. La primera visita debe hacerse
con conexión y esperar a que termine la descarga: activar el Service Worker por sí
solo no garantiza que todos los módulos estén ya disponibles offline. No sustituye
las comprobaciones en un teléfono real ni las de instalación de la PWA móvil.

### Validación de producción y restauración de backups

Desde la raíz, con Docker encendido:

```powershell
node deploy/test-produccion.cjs
```

Construye el stack de producción en un proyecto Docker temporal con puertos locales,
comprueba HTTPS, redirección, caché, cabeceras y las 6 migraciones, y verifica un
respaldo automático restaurándolo en otra base. Confirmado el 25/11/2026 con datos
de prueba y un adelanto de Bs 50. No toca `.env.prod` ni los datos del taller y no
equivale a verificar un VPS publicado. Más detalles en [DEPLOY.md](DEPLOY.md).

## Pendientes antes de una entrega final

- Comprobar instalación, visualización y offline en un teléfono real.
- Verificar dominio, DNS, certificado público y firewall cuando se publique en un VPS.
- Revisar las alertas de seguridad de dependencias detectadas por npm, sin aplicar actualizaciones incompatibles a ciegas.
- Ejecutar un piloto en el taller y recoger aceptación e indicadores antes/después: las pruebas locales no demuestran reducción de tiempos ni satisfacción de usuarios reales.
- Integrar el suplemento Word a la tesis original, ajustar numeración y revisar figuras; el original no estaba disponible en su ubicación anterior durante esta actualización.

La guía de despliegue está en [DEPLOY.md](DEPLOY.md). El suplemento para la tesis está en [docs/Actualizacion_tecnica_MotoraApp_2026-11-25.docx](docs/Actualizacion_tecnica_MotoraApp_2026-11-25.docx).
