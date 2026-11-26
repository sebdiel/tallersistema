// PostgreSQL efímero: sin montar volúmenes ni leer las credenciales del taller.
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const path = require('node:path');
const nombre = `motoraapp-e2e-${process.pid}-${Date.now()}`;
const password = randomBytes(24).toString('hex');
const env = { ...process.env, NODE_ENV: 'test', DB_HOST: '127.0.0.1', DB_USER: 'motora_test',
  DB_PASSWORD: password, DB_NAME: 'motoraapp_e2e', DB_SYNC: 'false', JWT_SECRET: randomBytes(32).toString('hex'),
  SEED_DEMO: 'true', SEED_ADMIN_EMAIL: 'admin@example.test', SEED_ADMIN_PASSWORD: password,
  SEED_SUPERADMIN_EMAIL: 'superadmin@example.test', SEED_SUPERADMIN_PASSWORD: password,
  SEED_TALLER_NOMBRE: 'Taller de pruebas', E2E_ISOLATED: 'true' };
function docker(args) {
  const r = spawnSync('docker', args, { encoding: 'utf8', timeout: 180000 });
  if (r.error || r.status !== 0) throw new Error(r.error?.message || r.stderr || 'Docker falló');
  return r.stdout.trim();
}
async function main() {
  let creado = false;
  try {
    docker(['run', '--detach', '--rm', '--name', nombre, '-p', '127.0.0.1::5432',
      '-e', 'POSTGRES_USER=motora_test', '-e', `POSTGRES_PASSWORD=${password}`,
      '-e', 'POSTGRES_DB=motoraapp_e2e', 'postgres:16-alpine']);
    creado = true;
    env.DB_PORT = docker(['inspect', '--format', '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}', nombre]);
    let listo = false;
    for (let i = 0; i < 60; i++) {
      const r = spawnSync('docker', ['exec', nombre, 'pg_isready', '-U', 'motora_test', '-d', 'motoraapp_e2e'], { encoding: 'utf8', timeout: 5000 });
      if (r.status === 0) { listo = true; break; }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!listo) throw new Error('PostgreSQL de pruebas no arrancó');
    const pwa = process.argv.includes('--pwa');
    console.log(`PostgreSQL aislado listo. Ejecutando ${pwa ? 'prueba PWA en navegador' : 'migraciones y pruebas HTTP'}.`);
    const args = pwa
      ? ['-r', 'ts-node/register/transpile-only', 'test/pwa-offline.cjs']
      : [require.resolve('jest/bin/jest'), '--config', './test/jest-e2e.json', '--runInBand'];
    const r = spawnSync(process.execPath, args,
      { cwd: path.join(__dirname, '..'), env, stdio: 'inherit', timeout: pwa ? 420000 : 180000 });
    if (r.error) throw r.error;
    process.exitCode = r.status ?? 1;
  } finally {
    if (creado) docker(['stop', nombre]);
  }
}
main().catch(err => { console.error(err.message); process.exitCode = 1; });
