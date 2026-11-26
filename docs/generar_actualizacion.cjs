// Genera el suplemento técnico y actualiza README a partir de la evidencia del repositorio.
// La biblioteca docx se puede indicar mediante DOCX_MODULE, sin agregarla al producto.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const anterior = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const hu = [...new Set(anterior.match(/^\| HU-\d+ .*$/gm) || [])];
const reglas = [...new Set((anterior.match(/^\| RN-\d+ .*$/gm) || [])
  .filter(r => Number(r.match(/RN-(\d+)/)[1]) <= 25))];
const inicioPruebas = anterior.indexOf('## Pruebas reproducibles del flujo de órdenes');
const corteAntiguo = anterior.indexOf('\nSistema web progresivo basado', inicioPruebas);
const finPruebas = corteAntiguo >= 0 ? corteAntiguo : anterior.indexOf('\n## Pendientes antes', inicioPruebas);
if (hu.length !== 29 || reglas.length !== 25 || inicioPruebas < 0 || finPruebas < 0) {
  throw new Error('No se reconocen las 29 HU, las 25 reglas originales o la evidencia; revise README antes de regenerar');
}
const evidencia = anterior.slice(inicioPruebas, finPruebas).trim();
const readme = `# MotoraApp — Sistema Web Progresivo para talleres mecánicos

Proyecto de Grado — Ingeniería de Sistemas, UAB.
Sistema basado en reglas de negocio para la gestión operativa de talleres mecánicos de microempresas en Cochabamba.

Estado revisado el **25/11/2026**. «TallerPro» es el nombre anterior; algunos identificadores internos, como la base IndexedDB \`tallerpro\`, conservan ese nombre para mantener los datos existentes.

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

- \`backend/src\`: autenticación, usuarios, clientes, vehículos, órdenes, inventario, reglas, sync, dashboard, suscripciones y migraciones.
- \`backend/test\`: integración HTTP y recorrido PWA aislados.
- \`frontend/src/app\`: interfaz, sesión, datos locales, sincronización y componentes.
- \`frontend/test\`: ejecución de las pruebas de componentes en Chrome/Edge.
- \`deploy\`: respaldo, restauración y prueba aislada de producción.
- \`docs\`: actualización técnica para incorporar a la tesis.

## Ejecutar en desarrollo

Requiere Node.js, npm y Docker Desktop. El compose de desarrollo utiliza PostgreSQL en el puerto 5432.

Primera terminal, desde la raíz:

\`\`\`powershell
docker compose up -d
cd backend
# Solo si todavía no existe .env:
Copy-Item .env.example .env
npm.cmd ci
npm.cmd run start:dev
\`\`\`

Segunda terminal, desde la raíz:

\`\`\`powershell
cd frontend
npm.cmd ci
npm.cmd start
\`\`\`

Abrir http://localhost:4200. La API se publica en http://localhost:3000/api.
No reemplace un archivo \`.env\` ya configurado. En desarrollo, las credenciales de demostración se definen en \`backend/.env.example\`; en producción deben configurarse credenciales propias, sin taller demo.

El Service Worker está desactivado en \`ng serve\`. Para verificar offline use el comando de prueba PWA indicado más abajo.

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

Modelo SaaS con un plan único; precio de referencia configurable mediante \`PRECIO_SUSCRIPCION\` (Bs 90/mes por defecto). La prueba inicial predeterminada es de 15 días. El SuperAdmin registra los pagos manualmente; no hay pasarela automática ni planes Básico/Gold implementados.

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
${hu.map(r => r.replace('✅ (el historial se llena en la Iteración 2)', '✅ Historial implementado')).join('\n')}

## Reglas de negocio documentadas

| Código | Regla | Implementación |
|---|---|---|
${reglas.map(r => r.replace('Ningún pago supera el saldo; ningún descuento o quitar un cargo deja el total por debajo de lo ya pagado', 'Los pagos respetan el saldo, excepto adelantos en Recibido/Diagnóstico; descuentos y bajas de cargos respetan lo ya cobrado')).join('\n')}
| RN-26 | Fecha estimada no anterior a recepción | DTO, servicio de órdenes y calendario |
| RN-27 | Costo estimado opcional y no negativo | DTO y recepción |
| RN-28 | Repuesto externo no afecta stock; si lo aporta el cliente, precio cero | Entidad y servicio de órdenes |
| RN-29 | Presupuesto guardado y motivo al editar precios posteriormente | Servicio, datos locales y detalle |
| RN-30 | Adelantos en etapas iniciales; no terminar ni entregar con sobrepago | Pagos y máquina de estados |

La asignación de mecánico está en el detalle de la orden. Las propuestas retiradas (aprobación por medio y retroceso a Diagnóstico) no se consideran funciones vigentes.

${evidencia}

## Pendientes antes de una entrega final

- Comprobar instalación, visualización y offline en un teléfono real.
- Verificar dominio, DNS, certificado público y firewall cuando se publique en un VPS.
- Revisar las alertas de seguridad de dependencias detectadas por npm, sin aplicar actualizaciones incompatibles a ciegas.
- Ejecutar un piloto en el taller y recoger aceptación e indicadores antes/después: las pruebas locales no demuestran reducción de tiempos ni satisfacción de usuarios reales.
- Integrar el suplemento Word a la tesis original, ajustar numeración y revisar figuras; el original no estaba disponible en su ubicación anterior durante esta actualización.

La guía de despliegue está en [DEPLOY.md](DEPLOY.md). El suplemento para la tesis está en [docs/Actualizacion_tecnica_MotoraApp_2026-11-25.docx](docs/Actualizacion_tecnica_MotoraApp_2026-11-25.docx).
`;
fs.writeFileSync(path.join(root, 'README.md'), readme);

const secciones = [
  { titulo: 'ACTUALIZACIÓN DE LA DOCUMENTACIÓN TÉCNICA', subtitulo: 'MotoraApp · Proyecto de Grado · 25 de noviembre de 2026',
    parrafos: [
      'Destino: Sección 2, Documentación Técnica. Este suplemento se preparó para incorporar las funcionalidades actuales y la evidencia técnica al documento principal. El Word original no se encontró en la ubicación utilizada anteriormente; por ello, no se afirma que se haya modificado ese documento.',
      'La aplicación, denominada anteriormente TallerPro, permite gestionar clientes, vehículos, órdenes, inventario, repuestos externos, mano de obra, presupuestos, cobros y suscripciones. Se mantuvieron algunos identificadores internos para no romper la compatibilidad con datos existentes.',
      'La validación se realizó en entornos locales separados de los datos del taller. Los resultados corresponden al software y a los escenarios ejecutados; no constituyen evidencia de una prueba piloto ni de un despliegue público.',
    ],
    tabla: { columnas: ['Validación', 'Resultado comprobado'], filas: [
      ['Backend unitario', '34 pruebas aprobadas, agrupadas en 5 suites.'],
      ['Integración HTTP', '8 pruebas aprobadas contra PostgreSQL temporal.'],
      ['Frontend', '20 pruebas aprobadas en Chrome sin interfaz, con servicios simulados.'],
      ['PWA sin conexión', 'Recorrido completo, cierre y reapertura de Chrome, reconexión y reenvío sin duplicados.'],
      ['Producción local', 'HTTPS, 6 migraciones, backup automático y restauración en otra base de prueba.'],
    ] },
    cierre: 'Las secciones siguientes pueden incorporarse al cierre de la Sección 2. La numeración de títulos y tablas deberá continuar la del documento principal.' },
  { titulo: '1. Actualización funcional y flujo de trabajo',
    parrafos: ['La recepción registra el motivo de ingreso, el kilometraje, observaciones, un costo aproximado opcional y la fecha estimada de entrega. El calendario permite identificar días ocupados sin impedir que el taller acepte más de una entrega. La asignación del mecánico se realiza en el detalle de la orden.'],
    tabla: { columnas: ['Etapa', 'Operaciones disponibles'], filas: [
      ['Recibido', 'Revisar la recepción, asignar mecánico y registrar adelantos.'],
      ['Diagnóstico', 'Documentar la falla; agregar repuestos, externos y mano de obra; preparar el presupuesto.'],
      ['Reparación', 'Ejecutar el trabajo y ajustar cantidades y precios. Los cambios posteriores al presupuesto requieren motivo.'],
      ['Terminado', 'Revisar costos, avisar al cliente por WhatsApp y cobrar el saldo.'],
      ['Entregado', 'Consultar el registro cerrado y cobrar deuda pendiente si existió una entrega a crédito.'],
    ] },
    cierre: 'La transición a Diagnóstico requiere un mecánico y la transición a Reparación exige diagnóstico guardado. Se puede reabrir una orden terminada hacia Reparación con motivo. El código actual no incluye el retorno de Reparación a Diagnóstico; no debe documentarse como implementado. La cancelación exige motivo y anular previamente los pagos vigentes.' },
  { titulo: '2. Presupuestos, repuestos y comunicación',
    parrafos: [
      'El costo estimado de recepción representa un valor referencial informado inicialmente. El presupuesto se construye con los cargos de la orden. Al iniciar Reparación se conserva el total de ese momento, de forma que los cambios posteriores pueden compararse con ese monto.',
      'El monto guardado no acredita por sí mismo la aprobación del cliente. La funcionalidad que registraba fecha y medio de aprobación se retiró. Por tanto, no corresponde afirmar que existe una firma, una autorización verificable ni una constancia de envío de mensajes.',
    ],
    tabla: { columnas: ['Concepto', 'Tratamiento'], filas: [
      ['Inventario', 'Descuenta stock; conserva cantidad, precio de venta y costo unitario registrados.'],
      ['Repuesto aportado por el cliente', 'Se registra como externo con precio cero. La instalación se cobra por separado.'],
      ['Repuesto del taller fuera de inventario', 'Se registra como externo con precio manual y costo opcional; no descuenta stock.'],
      ['Mano de obra', 'Se selecciona del catálogo o se escribe un trabajo libre con monto.'],
      ['Adelantos', 'Se admiten en Recibido y Diagnóstico aun si el total aún no cubre lo pagado. No se permite terminar o entregar con sobrepago.'],
      ['WhatsApp', 'En Terminado abre el chat con vehículo, total y saldo. El operador revisa y presiona Enviar; no se verifica entrega ni lectura.'],
    ] },
    cierre: 'Total = repuestos de inventario + externos cobrables + mano de obra − descuento. Saldo = total − pagos vigentes. El comprobante es de servicio y no constituye una factura fiscal del SIN. Los formularios de costos se presentan en ventanas emergentes para reducir la carga visual del detalle.' },
  { titulo: '3. Arquitectura, datos y suscripciones',
    parrafos: [
      'La interfaz se desarrolló con Angular 18; el servidor utiliza NestJS 10 y TypeORM sobre PostgreSQL 16. La operación offline combina el Service Worker, que guarda recursos de la aplicación, con IndexedDB mediante Dexie, que conserva datos y una cola de operaciones. El servidor aplica reglas de negocio y registra identificadores para reconocer reenvíos.',
      'En producción se emplea Docker Compose: Caddy sirve la aplicación y deriva /api al backend; PostgreSQL se mantiene sin puertos públicos y otro servicio ejecuta respaldos diarios con pg_dump. El backend se ejecuta con un usuario sin privilegios y aplica las migraciones al arrancar.',
    ],
    tabla: { columnas: ['Migración', 'Cambio principal'], filas: [
      ['EsquemaInicial', 'Tablas y relaciones de las cuatro iteraciones originales.'],
      ['FechaEntregaEstimada', 'Fecha acordada para entregar el vehículo.'],
      ['CostoEstimado', 'Valor aproximado de recepción.'],
      ['RepuestosExternos', 'Tabla para piezas que no salen del inventario.'],
      ['PresupuestoAprobado', 'Monto conservado al iniciar Reparación y motivos de cambios.'],
      ['RepuestosSugeridos', 'Campo heredado de sugerencias de recepción. La interfaz actual ya no ofrece ese buscador en Recepción.'],
    ] },
    cierre: 'Se conserva un modelo SaaS de plan único con precio configurable (Bs 90 mensuales por defecto), 15 días iniciales de prueba, aviso desde 7 días antes de vencer y 5 días de gracia. Los estados son ACTIVA, POR_VENCER, EN_GRACIA, VENCIDA y SUSPENDIDA. El SuperAdmin registra pagos manualmente. No existen planes Básico/Gold ni cobro automático.' },
  { titulo: '4. Estrategia de validación e integración HTTP',
    parrafos: ['Se utilizaron pruebas unitarias para reglas aisladas, pruebas de integración con una API NestJS y PostgreSQL reales, pruebas de componentes en Chrome y dos recorridos técnicos separados para offline y despliegue. Las credenciales y bases temporales no corresponden al taller. Las 34 pruebas unitarias cubren costos, servicio de órdenes, máquina de estados, suscripción y normalización de placas.'],
    tabla: { columnas: ['Caso', 'Comprobación HTTP', 'Resultado'], filas: [
      ['I-01', 'Aplicación de migraciones sobre una base vacía.', 'Aprobado'],
      ['I-02', 'Protección de API e inicio de sesión del administrador.', 'Aprobado'],
      ['I-03', 'Registro de cliente, vehículo, inventario y orden recibida.', 'Aprobado'],
      ['I-04', 'Rechazo de otra orden abierta del vehículo y registro de adelanto.', 'Aprobado'],
      ['I-05', 'Mecánico y diagnóstico obligatorios para avanzar.', 'Aprobado'],
      ['I-06', 'Presupuesto con inventario, externo y mano de obra; descuento de stock.', 'Aprobado'],
      ['I-07', 'Presupuesto conservado y motivo obligatorio al editar precio.', 'Aprobado'],
      ['I-08', 'Finalización, rechazo de sobrepago, cobro del saldo y cierre.', 'Aprobado'],
    ] },
    cierre: 'El caso integrado utilizó Bs 100 de repuesto de inventario, Bs 100 de repuesto externo y Bs 70 de mano de obra: presupuesto de Bs 270. Tras corregir el externo a Bs 120, el total fue Bs 290. Con adelanto de Bs 50 y cobro final de Bs 240, se obtuvo saldo cero. Es un escenario distinto del recorrido offline descrito en la sección siguiente.' },
  { titulo: '5. Pruebas de pantallas y trabajo sin conexión',
    parrafos: ['Se ejecutaron 20 pruebas de Angular en Chrome sin interfaz con Karma/Jasmine. Se utilizaron los formularios y plantillas reales con servicios simulados. Estas pruebas comprueban comportamiento de componentes; no equivalen a una inspección visual completa en distintos dispositivos.'],
    tabla: { columnas: ['Grupo', 'Cobertura', 'Casos'], filas: [
      ['Detalle de orden', 'Etapas, ventanas de costos, catálogo, errores de stock, descuento por rol, cierre y WhatsApp.', '11'],
      ['Recepción', 'Alta de vehículo/cliente, teléfono, cancelación, validación y fecha ocupada.', '5'],
      ['Acceso a rutas', 'Sesión y restricciones de administrador, mecánico y SuperAdmin.', '4'],
    ] },
    posteriores: [
      'Para offline se compiló la PWA de producción, con desactivación exclusiva de la descarga de fuentes durante el build de prueba. Se inició sesión y se esperó que los 41 recursos principales quedaran en caché. Activar el Service Worker no garantiza, por sí solo, que la precarga ya haya terminado.',
      'Sin conexión se creó una orden para un vehículo previamente descargado, se asignó el mecánico y se registraron diagnóstico, un repuesto de Bs 100, mano de obra de Bs 70 y un pago de Bs 50. La cola conservó 8 operaciones. Se cerró completamente Chrome y se reabrió el mismo perfil todavía offline, conservando la orden y sus cambios.',
      'Al reconectar se comprobó la cola vacía, el número definitivo de orden, total Bs 170, pagado Bs 50 y saldo Bs 120. El reenvío intencional de las mismas operaciones no duplicó la orden, los cargos ni el pago. El stock pasó de 5 a 4 unidades una sola vez.',
    ] },
  { titulo: '6. Producción local, hallazgos y límites',
    parrafos: ['Se construyeron las imágenes de producción y se levantó el compose en un proyecto temporal con puertos de loopback, credenciales aleatorias y volúmenes independientes. La prueba HTTPS aceptó el certificado local de Caddy exclusivamente dentro del script. No se publicó un VPS ni se comprobó un certificado público.'],
    tabla: { columnas: ['Comprobación', 'Resultado'], filas: [
      ['Infraestructura', 'HTTPS local, redirección, API y rutas Angular disponibles.'],
      ['Caché y cabeceras', 'JS/CSS con hash almacenables; manifiesto sin caché; cabeceras configuradas presentes.'],
      ['Datos y permisos', '6 migraciones aplicadas; base sin puerto público; proceso backend sin usuario root.'],
      ['Backup', 'El servicio automático generó un dump con cliente, vehículo, orden y adelanto de Bs 50.'],
      ['Restauración', 'Se recuperó el dump en otra base y se compararon cantidades, relaciones, identificadores y valores.',],
    ] },
    posteriores: [
      'Durante la validación se corrigió la falta de validación del motivo al editar precios después del presupuesto en el servidor. En la pantalla se corrigió la pérdida de selección y cantidad del repuesto tras un error de stock. También se corrigió la regla de caché de Caddy y se fortaleció el procedimiento de restauración mediante una transacción con detención ante errores.',
      'Quedan pendientes las pruebas en un teléfono real, la validación de dominio/DNS/firewall y certificado público al desplegar, la revisión de alertas de dependencias y una prueba piloto con usuarios del taller. No se han medido mejoras de tiempos de atención, satisfacción ni aceptación institucional.',
      'Los resultados respaldan el funcionamiento en los escenarios ejecutados y la recuperación local de datos desde un respaldo. No permiten afirmar ausencia total de defectos, cumplimiento certificado de una norma de calidad ni impacto operativo en el taller sin trabajo de campo.',
    ] },
  { titulo: '7. Evidencia reproducible e incorporación a la tesis',
    parrafos: [
      'La evidencia se conserva en el repositorio mediante archivos ejecutables. Los resultados deben acompañarse, al integrar la tesis, de capturas actuales de ejecución y de las pantallas definitivas si la carrera o el tutor las requieren. No deben utilizarse mockups como evidencia de ejecución.',
      'El documento principal debe usar MotoraApp como nombre del producto. Los cuatro objetivos e iteraciones originales se conservan; las ampliaciones se describen como ajustes del incremento correspondiente, sin inventar historias aprobadas adicionales. Deben retirarse cantidades antiguas de pruebas que ya no corresponden a las suites actuales.',
    ],
    tabla: { columnas: ['Evidencia', 'Archivo o comando'], filas: [
      ['Unitarias', 'backend: npm.cmd test -- --runInBand'],
      ['Integración HTTP', 'backend: npm.cmd run test:e2e'],
      ['Componentes y permisos', 'frontend: npm.cmd run test:ci'],
      ['PWA offline', 'backend: npm.cmd run test:pwa'],
      ['Producción y restauración', 'Raíz: node deploy/test-produccion.cjs'],
      ['Reglas y datos', 'backend/src/ordenes; backend/src/admin/suscripcion.ts; backend/src/database/migraciones.'],
    ] },
    cierre: 'Para el artículo original puede reportarse la validación técnica como resultado del desarrollo, conservando su alcance local. Las conclusiones de impacto sobre el taller deberán redactarse después del piloto con mediciones reales. El tutor deberá revisar la numeración, integración y correspondencia con los objetivos del documento principal.' },
];

const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  AlignmentType, HeadingLevel, Footer, PageNumber, ShadingType, PageBreak } = require(process.env.DOCX_MODULE || 'docx');
const width = 8839;
function par(text, opts = {}) { return new Paragraph({ alignment: AlignmentType.JUSTIFIED,
  spacing: { line: 360, after: 120 }, children: [new TextRun({ text, font: 'Times New Roman', size: 24 })], ...opts }); }
function tabla(t) {
  const widths = t.columnas.length === 3 ? [1200, 6200, 1439] : [2400, 6439];
  return new Table({ width: { size: width, type: WidthType.DXA }, columnWidths: widths,
    rows: [t.columnas, ...t.filas].map((fila, i) => new TableRow({ tableHeader: i === 0, cantSplit: true,
      children: fila.map((text, k) => new TableCell({ width: { size: widths[k], type: WidthType.DXA },
        shading: i === 0 ? { type: ShadingType.CLEAR, fill: 'E7EDF3' } : undefined,
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        children: [par(text, { alignment: AlignmentType.LEFT, spacing: { line: 280, after: 20 },
          children: [new TextRun({ text, font: 'Times New Roman', size: 24, bold: i === 0 })] })] })) })) });
}
const children = [];
secciones.forEach((s, i) => {
  if (i) children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(par(s.titulo, { heading: HeadingLevel.HEADING_1, alignment: i ? AlignmentType.LEFT : AlignmentType.CENTER,
    keepNext: true, spacing: { before: 0, after: 200, line: 360 },
    children: [new TextRun({ text: s.titulo, font: 'Times New Roman', size: 26, bold: true })] }));
  if (s.subtitulo) children.push(par(s.subtitulo, { alignment: AlignmentType.CENTER }));
  for (const p of s.parrafos) children.push(par(p));
  if (s.tabla) children.push(tabla(s.tabla));
  for (const p of s.posteriores || []) children.push(par(p));
  if (s.cierre) children.push(par(s.cierre));
});
const doc = new Document({ creator: '', lastModifiedBy: '', title: 'MotoraApp — Actualización de la documentación técnica',
  description: 'Evidencia técnica local comprobada al 25/11/2026; suplemento para integrar a la Sección 2.',
  styles: { default: { document: { run: { font: 'Times New Roman', size: 24 }, paragraph: { spacing: { line: 360 } } } } },
  sections: [{ properties: { page: { size: { width: 12240, height: 15840 },
    margin: { top: 1417, bottom: 1417, left: 1984, right: 1417 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
      children: [new TextRun({ children: [PageNumber.CURRENT], font: 'Times New Roman', size: 24 })] })] }) }, children }] });
Packer.toBuffer(doc).then(buffer => {
  const out = path.join(__dirname, 'Actualizacion_tecnica_MotoraApp_2026-11-25.docx');
  fs.writeFileSync(out, buffer);
  console.log('README actualizado: 29 HU, reglas vigentes y evidencia comprobada.');
  console.log(out);
}).catch(error => { console.error(error); process.exitCode = 1; });
