import { spawn, execFileSync } from 'node:child_process'
import pg from 'pg'

const container = process.env.ENGQUEST_POSTGRES_CONTAINER || 'poster-rag-db'
const host = process.env.ENGQUEST_POSTGRES_HOST || '127.0.0.1'
const port = Number(process.env.ENGQUEST_POSTGRES_PORT || 5432)
const user = execFileSync('docker', ['exec', container, 'printenv', 'POSTGRES_USER'], { encoding: 'utf8' }).trim() || 'postgres'
const password = execFileSync('docker', ['exec', container, 'printenv', 'POSTGRES_PASSWORD'], { encoding: 'utf8' }).trim()
if (!password) throw new Error('The PostgreSQL container has no POSTGRES_PASSWORD environment variable.')
const databaseUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/engquest_migration`
const testPort = 3198
const child = spawn(process.execPath, ['--env-file=.env.local', 'server/index.js'], {
  env: { ...process.env, DATABASE_BACKEND: 'postgres', DATABASE_URL: databaseUrl, PORT: String(testPort) },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let childOutput = ''
child.stdout.setEncoding('utf8').on('data', chunk => { childOutput += chunk })
child.stderr.setEncoding('utf8').on('data', chunk => { childOutput += chunk })

async function waitForServer() {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`PostgreSQL-backed API stopped during startup. ${childOutput}`)
    try {
      const response = await fetch(`http://127.0.0.1:${testPort}/api/health`)
      if (response.ok) return
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`PostgreSQL-backed API did not become ready. ${childOutput}`)
}

try {
  await waitForServer()
  const eventResponse = await fetch(`http://127.0.0.1:${testPort}/api/event-status`)
  if (!eventResponse.ok) throw new Error(`Event status returned HTTP ${eventResponse.status}.`)
  const adminResponse = await fetch(`http://127.0.0.1:${testPort}/api/admin/teams`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD }),
  })
  if (!adminResponse.ok) throw new Error(`Organizer team list returned HTTP ${adminResponse.status}.`)
  const adminData = await adminResponse.json()
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 })
  try {
    const result = await pool.query('SELECT COUNT(*)::int AS count FROM teams')
    if (adminData.teams?.length !== result.rows[0].count) throw new Error('API team count does not match the PostgreSQL staging table.')
    console.log(`PostgreSQL backend smoke check passed: health, event status, and organizer team list (${result.rows[0].count} teams).`)
  } finally {
    await pool.end()
  }
} finally {
  child.kill()
}
