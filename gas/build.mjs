// Bundles src/ into a single dist/Code.js for clasp.
// Apps Script only sees top-level function declarations, so the bundle is an
// IIFE assigned to a global and the footer re-exposes each entry point.
import { copyFileSync, mkdirSync } from 'node:fs'
import { build } from 'esbuild'

// Functions callable by Apps Script (triggers, web app, editor "Run" menu).
const ENTRY_POINTS = ['doGet', 'doPost', 'setupSheets', 'initToken', 'showToken']

const footer = ENTRY_POINTS.map(
  (name) => `function ${name}() { return SweepLog.${name}.apply(null, arguments); }`,
).join('\n')

mkdirSync('dist', { recursive: true })

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'SweepLog',
  target: 'es2020',
  outfile: 'dist/Code.js',
  footer: { js: footer },
  legalComments: 'none',
})

copyFileSync('appsscript.json', 'dist/appsscript.json')
console.log('Built dist/Code.js')
