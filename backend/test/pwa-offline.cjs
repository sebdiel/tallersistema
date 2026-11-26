// Recorre la PWA publicada localmente con perfil y PostgreSQL desechables.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const frontend = path.resolve(__dirname, '../../frontend');
const frontRequire = createRequire(path.join(frontend, 'package.json'));
const { chromium } = frontRequire('playwright');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const manual = process.argv.includes('--manual');

async function main() {
  assert.equal(process.env.E2E_ISOLATED, 'true');
  assert.equal(process.env.DB_NAME, 'motoraapp_e2e');
  assert.equal(process.env.DB_HOST, '127.0.0.1');
  const build = spawnSync(process.execPath,
    [frontRequire.resolve('@angular/cli/bin/ng.js'), 'build', '--configuration=production,pwa-test'],
    { cwd: frontend, stdio: 'inherit', timeout: 180000 });
  assert.equal(build.status, 0, 'Compilación PWA fallida');
  const dist = path.join(frontend, 'dist/pwa-test/browser');
  assert.ok(fs.existsSync(path.join(dist, 'ngsw-worker.js')), 'Falta el Service Worker');
  const chrome = [process.env.CHROME_BIN,
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
    process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Microsoft/Edge/Application/msedge.exe'),
    '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => p && fs.existsSync(p));
  assert.ok(chrome, 'Instale Chrome/Edge o configure CHROME_BIN');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'motoraapp-pwa-'));
  let app, server, browser;
  try {
    const migrations = require('../src/database/data-source').default;
    await migrations.initialize();
    try { await migrations.runMigrations({ transaction: 'all' }); }
    finally { await migrations.destroy(); }
    app = await NestFactory.create(require('../src/app.module').AppModule, { logger: ['error', 'warn'] });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    const apiPort = app.getHttpServer().address().port;
    server = http.createServer((req, res) => {
      if (req.url.startsWith('/api/')) {
        const proxy = http.request({ hostname: '127.0.0.1', port: apiPort, path: req.url,
          method: req.method, headers: req.headers }, upstream => {
          res.writeHead(upstream.statusCode, upstream.headers); upstream.pipe(res);
        });
        proxy.on('error', () => { res.statusCode = 502; res.end(); });
        req.pipe(proxy); return;
      }
      const route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let file = path.resolve(dist, '.' + route);
      if (!file.startsWith(dist + path.sep) && file !== dist) { res.statusCode = 403; res.end(); return; }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(dist, 'index.html');
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
        '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
      res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-cache'); fs.createReadStream(file).pipe(res);
    });
    const puertoWeb = manual ? Number(process.env.PWA_TEST_PORT || 8080) : 0;
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(puertoWeb, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    async function api(route, method = 'GET', body, token) {
      const response = await fetch(origin + '/api' + route, { method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const json = await response.json();
      assert.ok(response.ok, `${method} ${route}: ${response.status} ${JSON.stringify(json)}`); return json;
    }
    const login = await api('/auth/login', 'POST', { email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD });
    const token = login.accessToken;
    const cliente = await api('/clientes', 'POST', { nombre: 'Cliente offline', telefono: '70000000' }, token);
    await api('/vehiculos', 'POST', { clienteId: cliente.id, placa: '1234PWA', marca: 'Toyota', modelo: 'Offline', kilometraje: 1000 }, token);
    const pieza = await api('/repuestos', 'POST', { codigo: 'PWA-01', nombre: 'Pastillas offline', stock: 5, precioCompra: 60, precioVenta: 100 }, token);
    const launch = offline => chromium.launchPersistentContext(profile, {
      executablePath: chrome, headless: !manual, offline, serviceWorkers: 'allow', viewport: { width: 1280, height: 900 },
    });
    browser = await launch(false);
    let page = browser.pages()[0];
    page.setDefaultTimeout(20000);
    page.on('pageerror', error => console.error('Error del navegador:', error.message));
    await page.goto(origin + '/login');
    await page.locator('#email').fill(process.env.SEED_ADMIN_EMAIL);
    await page.locator('#password').fill(process.env.SEED_ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await page.waitForURL(origin + '/');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    });
    // La activación del worker no garantiza que ya haya instalado su versión.
    // Una navegación online permite terminar la inicialización y la precarga.
    await page.reload();
    await esperar(() => page.evaluate(async () => {
      const keys = await caches.keys();
      for (const key of keys.filter(k => k.includes(':assets:app:cache'))) {
        if (await (await caches.open(key)).match('/index.html')) return true;
      }
      return false;
    }), 'caché del documento principal');
    await page.getByRole('heading', { name: /^Hola,/ }).waitFor();
    const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'ngsw.json'), 'utf8'));
    console.log('Archivos esperados en caché:', manifest.assetGroups[0].urls.length);
    await esperar(() => page.evaluate(async urls => {
      const names = (await caches.keys()).filter(k => k.includes(':assets:app:cache'));
      for (const name of names) {
        const cache = await caches.open(name);
        if ((await cache.keys()).length >= urls.length &&
            (await Promise.all(urls.map(url => cache.match(url)))).every(Boolean)) return true;
      }
      return false;
    }, manifest.assetGroups[0].urls), 'precarga de todos los módulos');
    // Espera a que la versión quede asociada al cliente y persista su estado.
    await esperar(() => page.evaluate(async () => {
      const state = await fetch('/ngsw/state').then(r => r.text());
      return state.includes('Driver state: NORMAL') && !state.includes('Clients: \n')
        && !state.includes('initializeFully');
    }), 'versión del Service Worker');
    const cacheCompleta = await page.evaluate(async urls => {
      const all = [];
      for (const name of await caches.keys()) {
        if (name.includes(':assets:app:cache')) {
          const cache = await caches.open(name);
          const faltan = [];
          for (const url of urls) if (!(await cache.match(url))) faltan.push(url);
          all.push({ name, entradas: (await cache.keys()).length, faltan });
        }
      }
      return all;
    }, manifest.assetGroups[0].urls);
    console.log('Cache antes de desconectar:', cacheCompleta);
    assert.ok(cacheCompleta.some(c => c.faltan.length === 0), 'La descarga de la app todavía está incompleta');
    // Lee IndexedDB del perfil temporal para verificar persistencia y cola.
    const leer = (p, tabla) => p.evaluate(async nombre => {
      const db = await new Promise((resolve, reject) => {
        const r = indexedDB.open('tallerpro'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
      });
      try { return await new Promise((resolve, reject) => {
        const r = db.transaction(nombre).objectStore(nombre).getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
      }); } finally { db.close(); }
    }, tabla);
    async function esperar(fn, mensaje) {
      const hasta = Date.now() + 45000;
      while (Date.now() < hasta) { if (await fn()) return; await new Promise(r => setTimeout(r, 250)); }
      throw new Error('Tiempo agotado: ' + mensaje);
    }
    await esperar(async () => (await leer(page, 'vehiculos')).length === 1, 'descarga inicial');
    console.log('OK: sesión, Service Worker y copia local descargados.');
    if (manual) {
      console.log('\nPWA LISTA PARA PROBAR A MANO: ' + origin);
      console.log('Chrome ya está abierto y la sesión del taller de pruebas está iniciada.');
      console.log('Correo de prueba: ' + process.env.SEED_ADMIN_EMAIL);
      console.log('Contraseña de prueba: ' + process.env.SEED_ADMIN_PASSWORD);
      console.log('F12 > Network > Offline. Registre una orden y compruebe pendientes.');
      console.log('Recargue sin conexión; luego cambie a No throttling para sincronizar.');
      console.log('Mantenga esta terminal abierta. Cerrar Chrome ya no detiene el servidor.');
      console.log('Al terminar la prueba, presione Enter en esta terminal para apagarla.');
      console.log('Los datos son temporales y se eliminan al terminar esta prueba.\n');
      await new Promise(resolve => {
        const rl = require('node:readline').createInterface({ input: process.stdin, output: process.stdout });
        const fin = () => { rl.close(); resolve(); };
        rl.once('line', fin);
      });
      return;
    }
    await browser.setOffline(true);
    await page.getByRole('link', { name: '+ Recibir vehículo', exact: true }).click();
    await page.getByRole('button').filter({ hasText: /Toyota\s+Offline/ }).click();
    await page.locator('#problema').fill('Ruido al frenar sin conexión');
    await page.getByRole('button', { name: 'Abrir orden de trabajo', exact: true }).click();
    await page.waitForURL(/\/ordenes\/[a-f0-9-]+$/);
    const ordenUrl = page.url();
    const ordenId = ordenUrl.split('/').pop();
    await page.locator('select.buscador').selectOption(login.usuario.id);
    await page.getByRole('button', { name: 'Iniciar diagnóstico', exact: true }).click();
    await page.locator('textarea[placeholder="Qué encontró el mecánico y qué se hará"]').fill('Pastillas gastadas; cambiar pastillas');
    await page.getByRole('button', { name: 'Guardar diagnóstico', exact: true }).click();
    await page.getByRole('button', { name: 'Del inventario', exact: true }).click();
    await page.locator('#rep').selectOption(pieza.id);
    await page.getByRole('dialog').getByRole('button', { name: 'Agregar', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    const mano = page.locator('section.card').filter({ has: page.getByRole('heading', { name: 'Mano de obra', exact: true }) });
    await mano.getByRole('button', { name: 'Agregar', exact: true }).click();
    await page.locator('#mod').fill('Instalación offline'); await page.locator('#mom').fill('70');
    await page.getByRole('button', { name: 'Agregar mano de obra', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Iniciar reparación', exact: true }).click();
    await page.locator('#pm').fill('50');
    await page.getByRole('button', { name: 'Registrar pago', exact: true }).click();
    await esperar(async () => (await leer(page, 'cola')).some(op => op.tipo === 'orden.pago.registrar'), 'pago offline');
    const guardada = (await leer(page, 'ordenes')).find(o => o.id === ordenId);
    assert.equal(guardada.estado, 'EN_REPARACION');
    assert.equal(guardada.manoObra.length, 1); assert.equal(guardada.repuestos.length, 1);
    assert.equal(guardada.pagos.length, 1); assert.equal(guardada.totales.total, 170);
    const pendientes = await leer(page, 'cola'); assert.ok(pendientes.length >= 8);
    assert.equal((await api('/ordenes', 'GET', undefined, token)).length, 0);
    console.log(`OK: orden, diagnóstico, repuesto, mano de obra y pago offline (${pendientes.length} operaciones pendientes).`);
    // Cierra todo Chrome, vuelve a abrir el mismo perfil todavía sin conexión.
    await browser.close(); browser = await launch(true); page = browser.pages()[0]; page.setDefaultTimeout(20000);
    await page.goto(ordenUrl);
    await page.getByRole('heading', { name: 'Mano de obra', exact: true }).waitFor();
    const recuperada = (await leer(page, 'ordenes')).find(o => o.id === ordenId);
    assert.equal(recuperada.pagos[0].monto, 50);
    assert.equal((await leer(page, 'cola')).length, pendientes.length);
    console.log('OK: aplicación y cambios recuperados tras cerrar y reabrir Chrome sin internet.');
    await browser.setOffline(false);
    await esperar(async () => (await leer(page, 'cola')).length === 0, 'sincronización al reconectar');
    await esperar(async () => {
      const local = (await leer(page, 'ordenes')).find(o => o.id === ordenId);
      return local?.numero != null && !local._pendiente;
    }, 'confirmación local con número de orden del servidor');
    assert.equal((await leer(page, 'conflictos')).length, 0);
    const remota = await api('/ordenes/' + ordenId, 'GET', undefined, token);
    assert.equal(remota.totales.total, 170); assert.equal(remota.totales.pagado, 50); assert.equal(remota.totales.saldo, 120);
    assert.equal(remota.repuestos.length, 1); assert.equal(remota.manoObra.length, 1); assert.equal(remota.pagos.length, 1);
    // Reenvía intencionalmente las mismas operaciones para comprobar idempotencia.
    const replay = await api('/sync', 'POST', { operaciones: pendientes.map(({ id, tipo, ref, datos, creadaEn }) => ({ id, tipo, ref, datos, creadaEn })) }, token);
    assert.ok(replay.resultados.every(r => r.ok));
    const repetida = await api('/ordenes/' + ordenId, 'GET', undefined, token);
    assert.equal(repetida.pagos.length, 1); assert.equal(repetida.manoObra.length, 1); assert.equal(repetida.repuestos.length, 1);
    assert.equal((await api('/repuestos', 'GET', undefined, token)).find(p => p.id === pieza.id).stock, 4);
    assert.equal((await api('/ordenes', 'GET', undefined, token)).length, 1);
    console.log('OK: reconexión, totales, stock y reenvío sin duplicar orden, cargos ni pago.');
    console.log('PWA OFFLINE: TODAS LAS COMPROBACIONES APROBADAS.');
  } catch (err) {
    if (browser) {
      for (const p of browser.pages()) {
        console.error('Pantalla al fallar:', p.url(), (await p.locator('body').innerText().catch(() => '')).slice(0, 3500));
        console.error('Service Worker:', await p.evaluate(async () => ({
          controlador: navigator.serviceWorker.controller?.scriptURL,
          estado: await fetch('/ngsw/state').then(r => r.text()).catch(e => String(e)),
        })).catch(() => 'sin acceso'));
      }
    }
    throw err;
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
    if (app) await app.close();
    const target = path.resolve(profile);
    if (path.dirname(target) === path.resolve(os.tmpdir()) && path.basename(target).startsWith('motoraapp-pwa-')) {
      fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  }
}
main().catch(err => { console.error(err); process.exitCode = 1; });
