const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const candidatos = [process.env.CHROME_BIN,
  process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
  process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Microsoft/Edge/Application/msedge.exe'),
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
const chrome = candidatos.find(p => p && fs.existsSync(p));
if (!chrome) {
  console.error('Instale Chrome o indique su ejecutable con CHROME_BIN.');
  process.exitCode = 1;
} else {
  const resultado = spawnSync(process.execPath, [require.resolve('@angular/cli/bin/ng.js'), 'test',
    '--watch=false', '--browsers=ChromeHeadless', '--progress=false'], {
    cwd: path.join(__dirname, '..'), env: { ...process.env, CHROME_BIN: chrome }, stdio: 'inherit',
  });
  if (resultado.error) console.error(resultado.error.message);
  process.exitCode = resultado.status ?? 1;
}
