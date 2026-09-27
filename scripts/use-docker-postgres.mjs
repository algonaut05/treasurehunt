import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'

const container = process.env.ENGQUEST_POSTGRES_CONTAINER || 'poster-rag-db'
const host = process.env.ENGQUEST_POSTGRES_HOST || '127.0.0.1'
const port = Number(process.env.ENGQUEST_POSTGRES_PORT || 5432)
const user = execFileSync('docker', ['exec', container, 'printenv', 'POSTGRES_USER'], { encoding: 'utf8' }).trim() || 'postgres'
const password = execFileSync('docker', ['exec', container, 'printenv', 'POSTGRES_PASSWORD'], { encoding: 'utf8' }).trim()
if (!password) throw new Error('The PostgreSQL container has no POSTGRES_PASSWORD environment variable.')

const url = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/engquest_migration`
const envPath = '.env.local'
const content = await readFile(envPath, 'utf8')
const updates = new Map([['DATABASE_BACKEND', 'postgres'], ['DATABASE_URL', url]])
const seen = new Set()
const lines = content.split(/\r?\n/).map(line => {
  const match = line.match(/^\s*#?\s*(DATABASE_BACKEND|DATABASE_URL)=/)
  if (!match) return line
  seen.add(match[1])
  return `${match[1]}=${updates.get(match[1])}`
})
for (const [key, value] of updates) if (!seen.has(key)) lines.push(`${key}=${value}`)
await writeFile(envPath, lines.join('\n'), 'utf8')
console.log('Local API configured to use the isolated engquest_migration PostgreSQL database.')
