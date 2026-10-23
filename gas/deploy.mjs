// Publishes the web app while keeping one stable URL.
// The first run creates a deployment and remembers its ID in .deployment.json
// (gitignored); later runs move that same deployment to a new version.
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const STATE_FILE = '.deployment.json'
const description = `sweeplog ${new Date().toISOString()}`

function clasp(args) {
  // A single command string: npx needs a shell on Windows.
  return execSync(['npx', 'clasp', ...args].join(' '), { encoding: 'utf8' })
}

let deploymentId
if (existsSync(STATE_FILE)) {
  deploymentId = JSON.parse(readFileSync(STATE_FILE, 'utf8')).deploymentId
  clasp(['redeploy', deploymentId, '-d', `"${description}"`])
} else {
  const out = clasp(['deploy', '-d', `"${description}"`, '--json'])
  deploymentId = JSON.parse(out).deploymentId
  writeFileSync(STATE_FILE, JSON.stringify({ deploymentId }, null, 2) + '\n')
}

console.log(`Deployed. Web App URL:\nhttps://script.google.com/macros/s/${deploymentId}/exec`)
