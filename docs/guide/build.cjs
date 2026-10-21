'use strict'
/** Builds Arsenale-Guide-1.1.pdf from docs/guide/src with headless Chrome.
 *  node docs/guide/build.cjs */
const fs = require('fs')
const path = require('path')
const os = require('os')
const { spawnSync } = require('child_process')
const H = require('../../tools/help-page.cjs')

const OUT = path.join(__dirname, 'Arsenale-Guide-' + require('../../package.json').version.replace(/\.\d+$/, '') + '.pdf')
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p))
if (!CHROME) { console.error('Chrome not found'); process.exit(1) }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ars-guide-'))
const html = path.join(__dirname, 'src', '_build.html')
// the page sits in docs/guide/src, the pictures in docs/
fs.writeFileSync(html, H.render('pdf', { imgBase: '../../' }))
try {
  const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--user-data-dir=' + tmp, '--print-to-pdf=' + OUT, '--allow-file-access-from-files', 'file:///' + html.replace(/\\/g, '/')], { stdio: 'inherit', timeout: 120000 })
  if (r.status !== 0 || !fs.existsSync(OUT)) { console.error('PDF failed'); process.exit(1) }
  console.log('wrote ' + OUT)
} finally {
  try { fs.unlinkSync(html) } catch { /* gone */ }
  try { fs.rmSync(tmp, { recursive: true, force: true }) } catch { /* temp */ }
}
