import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import pg from 'pg'

const container = process.env.ENGQUEST_POSTGRES_CONTAINER || 'poster-rag-db'
const host = process.env.ENGQUEST_POSTGRES_HOST || '127.0.0.1'
const port = Number(process.env.ENGQUEST_POSTGRES_PORT || 5432)
const database = 'engquest_migration'
const user = execFileSync('docker', ['exec', container, 'printenv', 'POSTGRES_USER'], { encoding: 'utf8' }).trim() || 'postgres'
const password = execFileSync('docker', ['exec', container, 'printenv', 'POSTGRES_PASSWORD'], { encoding: 'utf8' }).trim()
if (!password) throw new Error('The PostgreSQL container has no POSTGRES_PASSWORD environment variable.')

const pool = new pg.Pool({ host, port, user, password, database, max: 1, connectionTimeoutMillis: 5000 })
try {
  const tables = await pool.query("SELECT COUNT(*)::int AS count FROM pg_catalog.pg_tables WHERE schemaname = 'public'")
  if (tables.rows[0].count !== 7) throw new Error('Expected the existing EngQuest migration schema; refusing to modify this database.')
  const schema = await readFile(resolve('migrations/001_postgresql_schema.sql'), 'utf8')
  await pool.query(schema)
  console.log('Updated the schema in the isolated engquest_migration database.')
} finally {
  await pool.end()
}
