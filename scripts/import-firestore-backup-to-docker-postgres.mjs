import { execFileSync, spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Pool } = pg
const backupPath = process.argv[2]
if (!backupPath) throw new Error('Usage: node scripts/import-firestore-backup-to-docker-postgres.mjs <backup.json>')

const container = process.env.ENGQUEST_POSTGRES_CONTAINER || 'poster-rag-db'
const host = process.env.ENGQUEST_POSTGRES_HOST || '127.0.0.1'
const port = Number(process.env.ENGQUEST_POSTGRES_PORT || 5432)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('ENGQUEST_POSTGRES_PORT must be a valid port number.')

function containerEnv(name) {
  return execFileSync('docker', ['exec', container, 'printenv', name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

const user = containerEnv('POSTGRES_USER') || 'postgres'
const password = containerEnv('POSTGRES_PASSWORD')
if (!password) throw new Error('The PostgreSQL container has no POSTGRES_PASSWORD environment variable.')

const backupBytes = await readFile(resolve(backupPath))
const backup = JSON.parse(backupBytes.toString('utf8'))
if (backup.format !== 'engquest-firestore-export-v1') throw new Error('Unsupported Firestore backup format.')

const database = 'engquest_migration'
const adminPool = new Pool({ host, port, user, password, database: 'postgres', max: 2, connectionTimeoutMillis: 5000 })
let targetPool
try {
  const admin = await adminPool.connect()
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [database])
    if (!exists.rowCount) await admin.query(`CREATE DATABASE ${database}`)
  } finally {
    admin.release()
  }

  targetPool = new Pool({ host, port, user, password, database, max: 2, connectionTimeoutMillis: 5000 })
  const existingTables = await targetPool.query("SELECT COUNT(*)::int AS count FROM pg_catalog.pg_tables WHERE schemaname = 'public'")
  const scriptDirectory = dirname(fileURLToPath(import.meta.url))
  if (existingTables.rows[0].count === 0) {
    const schema = await readFile(resolve(scriptDirectory, '..', 'migrations', '001_postgresql_schema.sql'), 'utf8')
    await targetPool.query(schema)
  } else {
    const readyTables = await targetPool.query(`SELECT COUNT(*)::int AS count FROM pg_catalog.pg_tables
      WHERE schemaname = 'public' AND tablename = ANY($1::text[])`, [[
      'teams', 'team_names', 'enrollments', 'system_state', 'photo_proofs',
      'migration_unmapped_documents', 'migration_metadata',
    ]])
    if (readyTables.rows[0].count !== 7) throw new Error(`Database ${database} has tables from an unknown schema; refusing to modify it.`)
    const dataRows = await targetPool.query(`SELECT
      (SELECT COUNT(*)::int FROM teams) +
      (SELECT COUNT(*)::int FROM team_names) +
      (SELECT COUNT(*)::int FROM enrollments) +
      (SELECT COUNT(*)::int FROM system_state) +
      (SELECT COUNT(*)::int FROM photo_proofs) +
      (SELECT COUNT(*)::int FROM migration_unmapped_documents) AS count`)
    if (dataRows.rows[0].count !== 0) throw new Error(`Database ${database} already contains migration data; refusing to overwrite it.`)
  }

  const encodedUser = encodeURIComponent(user)
  const encodedPassword = encodeURIComponent(password)
  const databaseUrl = `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${database}`
  const importer = resolve(scriptDirectory, 'import-firestore-backup-to-postgres.mjs')
  const child = spawnSync(process.execPath, [importer, resolve(backupPath), '--apply'], {
    cwd: resolve(scriptDirectory, '..'),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  })
  if (child.error) throw child.error
  if (child.status !== 0) throw new Error(`PostgreSQL import failed with exit code ${child.status}.`)

  const counts = await targetPool.query(`SELECT
    (SELECT COUNT(*)::int FROM teams) AS teams,
    (SELECT COUNT(*)::int FROM team_names) AS team_names,
    (SELECT COUNT(*)::int FROM enrollments) AS enrollments,
    (SELECT COUNT(*)::int FROM system_state) AS system_state,
    (SELECT COUNT(*)::int FROM photo_proofs) AS photo_proofs,
    (SELECT COUNT(*)::int FROM migration_unmapped_documents) AS unmapped_documents`)
  const actual = counts.rows[0]
  const expected = {
    teams: backup.collectionCounts.teams || 0,
    team_names: backup.collectionCounts.teamNames || 0,
    enrollments: backup.collectionCounts.enrollments || 0,
    system_state: backup.collectionCounts.system || 0,
    photo_proofs: (backup.collectionCounts.round3PhotoProofs || 0) + (backup.collectionCounts.round7PhotoProofs || 0),
    unmapped_documents: 0,
  }
  for (const [table, count] of Object.entries(expected)) {
    if (actual[table] !== count) throw new Error(`Post-import verification failed for ${table}.`)
  }
  console.log(`Verified isolated database ${database}: ${actual.teams} teams, ${actual.enrollments} enrollments, ${actual.photo_proofs} photo proofs.`)
} finally {
  await targetPool?.end()
  await adminPool.end()
}
