// Vista previa del DOCX con docx-preview; no modifica el archivo Word.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const front = createRequire(path.resolve(__dirname, '../frontend/package.json'));
const { chromium } = front('playwright');
const modules = path.dirname(process.env.DOCX_MODULE || require.resolve('docx'));
async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 1300 }, deviceScaleFactor: 1 });
    await page.setContent('<html lang="es"><head><meta charset="utf-8"></head><body></body></html>');
    await page.addScriptTag({ path: path.join(modules, 'jszip/dist/jszip.min.js') });
    await page.addScriptTag({ path: path.join(modules, 'docx-preview/dist/docx-preview.js') });
    const stem = 'Actualizacion_tecnica_MotoraApp_2026-11-25';
    const bytes = fs.readFileSync(path.join(__dirname, stem + '.docx')).toString('base64');
    await page.evaluate(async b64 => {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      await docx.renderAsync(bytes, document.body, undefined, { breakPages: true, ignoreLastRenderedPageBreak: true,
        renderHeaders: true, renderFooters: true });
      await document.fonts.ready;
    }, bytes);
    const dir = path.join(__dirname, 'vista_previa'); fs.mkdirSync(dir, { recursive: true });
    const pages = page.locator('section.docx');
    const count = await pages.count();
    for (let i = 0; i < count; i++) await pages.nth(i).screenshot({ path: path.join(dir, `pagina-${String(i + 1).padStart(2, '0')}.png`) });
    const layout = await pages.evaluateAll(sections => sections.map((s, i) => ({
      pagina: i + 1, altura: s.getBoundingClientRect().height,
      tablas: s.querySelectorAll('table').length,
      desbordeHorizontal: s.scrollWidth > s.clientWidth + 2,
    })));
    fs.writeFileSync(path.join(dir, 'revision.json'), JSON.stringify(layout, null, 2));
    console.log(JSON.stringify(layout));
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
