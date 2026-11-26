// Levanta el compose de producción con recursos y secretos exclusivamente de prueba.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const https = require('node:https');
const http = require('node:http');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const proyecto = `motoraapp-prod-test-${process.pid}-${Date.now()}`;
const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'motoraapp-prod-test-'));
const backups = path.join(temporal, 'backups'); fs.mkdirSync(backups);
const secreto = randomBytes(24).toString('hex');
const envFile = path.join(temporal, 'test.env');
fs.writeFileSync(envFile, [
  'DOMAIN=localhost', 'ACME_EMAIL=admin@example.test', `POSTGRES_PASSWORD=${secreto}`,
  `JWT_SECRET=${randomBytes(32).toString('hex')}`, 'SEED_SUPERADMIN_EMAIL=superadmin@example.test',
  `SEED_SUPERADMIN_PASSWORD=${secreto}`, 'HTTP_PORT=127.0.0.1:0', 'HTTPS_PORT=127.0.0.1:0',
].join('\n'));
const override = path.join(temporal, 'override.json');
fs.writeFileSync(override, JSON.stringify({ services: {
  backup: { volumes: [{ type: 'bind', source: backups, target: '/backups' }] },
} }));
const base = ['compose', '-p', proyecto, '--env-file', envFile, '-f', path.join(root, 'docker-compose.prod.yml'), '-f', override];
function compose(args, options = {}) {
  const r = spawnSync('docker', [...base, ...args], { cwd: root, encoding: 'utf8', timeout: 300000, ...options });
  if (r.error || r.status !== 0) throw new Error(r.error?.message || r.stderr || `Falló compose ${args[0]}`);
  return r.stdout?.trim();
}
async function esperar(fn, nombre, ms = 90000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { if (await fn()) return; await new Promise(r => setTimeout(r, 500)); }
  throw new Error('Tiempo agotado: ' + nombre);
}
function pedir(port, route, method = 'GET', body, token, secure = true) {
  return new Promise((resolve, reject) => {
    const bytes = body === undefined ? undefined : JSON.stringify(body);
    const request = (secure ? https : http).request({ hostname: '127.0.0.1', port, path: route,
      method, servername: 'localhost', rejectUnauthorized: false,
      headers: { Host: `localhost:${port}`, ...(bytes ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bytes) } : {}),
        ...(token ? { Authorization: 'Bearer ' + token } : {}) } }, res => {
      const chunks = []; res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString() }));
    });
    request.setTimeout(8000, () => request.destroy(new Error('Timeout HTTP')));
    request.on('error', reject); if (bytes) request.write(bytes); request.end();
  });
}
async function main() {
  let iniciado = false;
  try {
    const config = JSON.parse(compose(['config', '--format', 'json']));
    assert.ok(!config.services.db.ports?.length, 'PostgreSQL no debe publicar puertos');
    assert.ok(!config.services.backend.ports?.length, 'La API debe exponerse solo a través de Caddy');
    assert.ok(config.services.web.ports.every(p => p.host_ip === '127.0.0.1'), 'Los puertos de prueba deben ser locales');
    console.log('OK: configuración de producción y aislamiento de puertos.');
    // Solo este proyecto temporal se desmonta al terminar, incluso si el build falla.
    iniciado = true;
    compose(['up', '-d', '--build'], { stdio: 'inherit', timeout: 900000 });
    const published = compose(['port', 'web', '443']);
    const port = Number(published.split(':').pop());
    const httpPort = Number(compose(['port', 'web', '80']).split(':').pop());
    await esperar(async () => { try { return (await pedir(port, '/api/health')).status === 200; } catch { return false; } }, 'HTTPS y API');
    const health = await pedir(port, '/api/health');
    assert.equal(JSON.parse(health.text).status, 'ok');
    const redireccion = await pedir(httpPort, '/', 'GET', undefined, undefined, false);
    assert.ok([301, 302, 307, 308].includes(redireccion.status));
    assert.ok(redireccion.headers.location.startsWith('https://'));
    const index = await pedir(port, '/ordenes/nueva'); assert.equal(index.status, 200);
    assert.ok(index.text.includes('<app-root'));
    assert.equal(index.headers['x-content-type-options'], 'nosniff');
    assert.equal(index.headers['x-frame-options'], 'DENY');
    assert.ok(index.headers['strict-transport-security']);
    const sw = await pedir(port, '/ngsw.json'); assert.equal(sw.status, 200);
    assert.equal(sw.headers['cache-control'], 'no-cache');
    const manifest = JSON.parse(sw.text);
    const js = manifest.assetGroups[0].urls.find(u => /-[A-Z0-9]{8}\.js$/.test(u));
    assert.ok(js); assert.match((await pedir(port, js)).headers['cache-control'], /immutable/);
    const uid = compose(['exec', '-T', 'backend', 'id', '-u']); assert.notEqual(uid, '0');
    const migraciones = JSON.parse(compose(['exec', '-T', 'db', 'psql', '-U', 'taller', '-d', 'taller_db', '-tAc',
      'SELECT json_agg(name ORDER BY timestamp) FROM migrations']));
    assert.equal(migraciones.length, fs.readdirSync(path.join(root, 'backend/src/database/migraciones')).filter(n => n.endsWith('.ts')).length);
    console.log('OK: HTTPS local, redirección, rutas Angular, PWA, caché, cabeceras y API sin privilegios.');
    console.log(`OK: ${migraciones.length} migraciones aplicadas al arrancar una base vacía.`);
    const api = async (route, method, body, token) => {
      const r = await pedir(port, '/api' + route, method, body, token);
      assert.ok(r.status >= 200 && r.status < 300, `${route}: ${r.status} ${r.text}`); return JSON.parse(r.text);
    };
    const superadmin = await api('/auth/login', 'POST', { email: 'superadmin@example.test', password: secreto });
    await api('/admin/talleres', 'POST', { nombre: 'Taller restauración',
      admin: { nombre: 'Administrador prueba', email: 'admin@example.test', password: secreto } }, superadmin.accessToken);
    const login = await api('/auth/login', 'POST', { email: 'admin@example.test', password: secreto });
    const token = login.accessToken;
    const cliente = await api('/clientes', 'POST', { nombre: 'Cliente respaldado', telefono: '70000000' }, token);
    const vehiculo = await api('/vehiculos', 'POST', { clienteId: cliente.id, placa: '1234BKP', marca: 'Toyota', modelo: 'Backup', kilometraje: 1000 }, token);
    const orden = await api('/ordenes', 'POST', { vehiculoId: vehiculo.id, kilometrajeIngreso: 1000, problemaReportado: 'Prueba de restauración', costoEstimado: 200 }, token);
    await api(`/ordenes/${orden.id}/pagos`, 'POST', { monto: 50, metodo: 'EFECTIVO' }, token);
    const conteo = db => compose(['exec', '-T', 'db', 'psql', '-U', 'taller', '-d', db, '-tAc',
      'SELECT json_build_object(\'clientes\',(SELECT count(*) FROM clientes),\'vehiculos\',(SELECT count(*) FROM vehiculos),\'ordenes\',(SELECT count(*) FROM ordenes_trabajo),\'pagos\',(SELECT sum(monto) FROM pagos),\'migraciones\',(SELECT count(*) FROM migrations))']);
    const original = JSON.parse(conteo('taller_db'));
    // Se ejecuta el script real de backup reiniciando solamente el servicio de prueba.
    const anteriores = new Map(fs.readdirSync(backups).map(f => [f, fs.statSync(path.join(backups, f)).mtimeMs]));
    compose(['restart', 'backup']);
    let archivo;
    await esperar(async () => {
      archivo = fs.readdirSync(backups).filter(f => f.endsWith('.dump'))
        .find(f => !anteriores.has(f) || fs.statSync(path.join(backups, f)).mtimeMs > anteriores.get(f));
      return !!archivo;
    }, 'respaldo automático');
    const dump = fs.readFileSync(path.join(backups, archivo)); assert.ok(dump.length > 100);
    compose(['exec', '-T', 'db', 'createdb', '-U', 'taller', 'motora_restore_test']);
    compose(['exec', '-T', 'db', 'pg_restore', '-U', 'taller', '-d', 'motora_restore_test',
      '--no-owner', '--exit-on-error', '--single-transaction'], { input: dump });
    assert.deepEqual(JSON.parse(conteo('motora_restore_test')), original);
    const copia = JSON.parse(compose(['exec', '-T', 'db', 'psql', '-U', 'taller', '-d', 'motora_restore_test', '-tAc',
      `SELECT json_build_object('id',o.id,'motivo',o.problema_reportado,'estimado',o.costo_estimado,'placa',v.placa,'cliente',c.nombre,'pagado',(SELECT sum(monto) FROM pagos WHERE orden_id=o.id)) FROM ordenes_trabajo o JOIN vehiculos v ON v.id=o.vehiculo_id JOIN clientes c ON c.id=o.cliente_id WHERE o.id='${orden.id}'`]));
    assert.equal(copia.id, orden.id); assert.equal(copia.placa, '1234BKP'); assert.equal(copia.cliente, 'Cliente respaldado');
    assert.equal(copia.estimado, 200); assert.equal(copia.pagado, 50); assert.equal(copia.motivo, 'Prueba de restauración');
    compose(['exec', '-T', 'backup', 'sh', '-n', '/backup.sh']);
    console.log('OK: backup automático real y restauración transaccional en otra base, con cliente, vehículo, orden y pago íntegros.');
    console.log('PRODUCCIÓN LOCAL: TODAS LAS COMPROBACIONES APROBADAS.');
  } finally {
    if (iniciado && /^motoraapp-prod-test-\d+-\d+$/.test(proyecto)) {
      compose(['down', '--volumes', '--remove-orphans'], { stdio: 'inherit', timeout: 120000 });
    }
    const target = path.resolve(temporal);
    if (path.dirname(target) === path.resolve(os.tmpdir()) && path.basename(target).startsWith('motoraapp-prod-test-')) {
      fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  }
}
main().catch(err => { console.error(err.message); process.exitCode = 1; });
