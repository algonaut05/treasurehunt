import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import pg from 'pg'

const { Pool } = pg
const backupPath = process.argv[2]
if (!backupPath) throw new Error('Usage: node scripts/import-firestore-backup-to-postgres.mjs <backup.json> [--apply]')
const apply = process.argv.includes('--apply')
const databaseUrl = process.env.DATABASE_URL
if (apply && !databaseUrl) throw new Error('Set DATABASE_URL in .env.local before using --apply.')

const backupBytes = await readFile(resolve(backupPath))
const backup = JSON.parse(backupBytes.toString('utf8'))
if (backup.format !== 'engquest-firestore-export-v1' || !Array.isArray(backup.documents)) {
  throw new Error('Unsupported or incomplete Firestore backup format.')
}

const docs = new Map(backup.documents.map(document => [document.path, document.data]))
const teams = []
const enrollments = []
const teamNames = []
const system = []
const proofs = []
const unmapped = []
const mappedPaths = new Set()
const collection = (path, collectionName) => path.startsWith(`${collectionName}/`) && path.split('/').length === 2
const nameKey = value => Buffer.from(String(value).trim().toLowerCase(), 'utf8').toString('base64url')
const asText = value => value == null ? null : typeof value === 'string' ? value : value?.$type === 'timestamp' || value?.$type === 'date' ? value.value : JSON.stringify(value)
const json = value => JSON.stringify(value ?? null)

for (const [path, data] of docs) {
  const parts = path.split('/')
  if (collection(path, 'teams')) {
    const id = parts[1]
    if (!data || data.id !== id || typeof data.name !== 'string' || typeof data.password !== 'string') {
      throw new Error(`Invalid team record at ${path}; import stopped before writing.`)
    }
    teams.push({
      id, name: data.name, nameKey: nameKey(data.name), password: data.password,
      members: json(data.members || []), progress: Number(data.progress || 0),
      registeredAt: asText(data.registeredAt) || new Date(0).toISOString(),
      lastActivityAt: asText(data.lastActivityAt ?? data.registeredAt),
      round3RequestedAt: asText(data.round3RequestedAt),
      round3PhotoSubmittedAt: asText(data.round3PhotoSubmittedAt),
      round3RejectedAt: asText(data.round3RejectedAt),
      round3ApprovedAt: asText(data.round3ApprovedAt),
      round4CluePassword: asText(data.round4CluePassword ?? data.round3CluePassword),
      round7RequestedAt: asText(data.round7RequestedAt),
      round7PhotoSubmittedAt: asText(data.round7PhotoSubmittedAt),
      round7RejectedAt: asText(data.round7RejectedAt),
      round7ApprovedAt: asText(data.round7ApprovedAt),
      rawData: json(data),
    })
    mappedPaths.add(path)
  } else if (collection(path, 'enrollments')) {
    enrollments.push({ key: parts[1], teamId: data.teamId, rawData: json(data) })
    mappedPaths.add(path)
  } else if (collection(path, 'teamNames')) {
    teamNames.push({ key: parts[1], teamId: data.teamId, rawData: json(data) })
    mappedPaths.add(path)
  } else if (collection(path, 'system')) {
    system.push({ id: parts[1], data: json(data) })
    mappedPaths.add(path)
  } else if (collection(path, 'round3PhotoProofs') || collection(path, 'round7PhotoProofs')) {
    proofs.push({
      teamId: parts[1], round: collection(path, 'round3PhotoProofs') ? 3 : 7,
      filename: data.filename ?? null, contentType: data.contentType ?? null,
      uploadedAt: asText(data.uploadedAt), rawData: json(data),
    })
    mappedPaths.add(path)
  }
}

for (const team of teams) {
  if (!Number.isInteger(team.progress) || team.progress < 0 || team.progress > 7) throw new Error(`Invalid progress value in team ${team.id}.`)
}
const teamIds = new Set(teams.map(team => team.id))
for (const item of [...enrollments, ...teamNames, ...proofs]) {
  if (!teamIds.has(item.teamId)) throw new Error(`Document references missing team ${item.teamId}; import stopped before writing.`)
}
const names = teamNames.length ? teamNames : teams.map(team => ({ key: team.nameKey, teamId: team.id, rawData: json({ teamId: team.id }) }))
for (const item of docs) {
  const path = item[0]
  if (!mappedPaths.has(path)) unmapped.push({ path, data: json(item[1]) })
}

const summary = {
  sourceExportedAt: backup.exportedAt,
  sourceCollections: backup.collectionCounts,
  rows: {
    teams: teams.length, teamNames: names.length, enrollments: enrollments.length,
    systemState: system.length, photoProofs: proofs.length, unmappedDocuments: unmapped.length,
  },
}

if (!apply) {
  console.log('Dry run only; PostgreSQL was not changed.')
  console.log(JSON.stringify(summary, null, 2))
  console.log('Pass --apply with DATABASE_URL to import into an empty database after applying migrations/001_postgresql_schema.sql.')
  process.exit(0)
}

const pool = new Pool({ connectionString: databaseUrl, max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000 })
const client = await pool.connect()
try {
  const tableNames = ['teams', 'team_names', 'enrollments', 'system_state', 'photo_proofs', 'migration_unmapped_documents']
  const counts = []
  for (const table of tableNames) {
    const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${table}`)
    counts.push(result.rows[0].count)
  }
  if (counts.some(count => count !== 0)) throw new Error('Target database is not empty. Import stopped without changing it.')

  await client.query('BEGIN')
  try {
    for (const team of teams) {
      await client.query(
        `INSERT INTO teams (
          team_id, name, name_key, password, members, progress, registered_at, last_activity_at,
          round3_requested_at, round3_photo_submitted_at, round3_rejected_at, round3_approved_at,
          round4_clue_password, round7_requested_at, round7_photo_submitted_at, round7_rejected_at,
          round7_approved_at, raw_data
        ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb)`,
        [team.id, team.name, team.nameKey, team.password, team.members, team.progress, team.registeredAt,
          team.lastActivityAt, team.round3RequestedAt, team.round3PhotoSubmittedAt, team.round3RejectedAt,
          team.round3ApprovedAt, team.round4CluePassword, team.round7RequestedAt,
          team.round7PhotoSubmittedAt, team.round7RejectedAt, team.round7ApprovedAt, team.rawData],
      )
    }
    for (const item of names) await client.query(
      'INSERT INTO team_names(name_key, team_id, raw_data) VALUES ($1,$2,$3::jsonb)', [item.key, item.teamId, item.rawData],
    )
    for (const item of enrollments) await client.query(
      'INSERT INTO enrollments(enrollment_key, team_id, raw_data) VALUES ($1,$2,$3::jsonb)', [item.key, item.teamId, item.rawData],
    )
    for (const item of system) await client.query(
      'INSERT INTO system_state(document_id, data) VALUES ($1,$2::jsonb)', [item.id, item.data],
    )
    for (const item of proofs) await client.query(
      'INSERT INTO photo_proofs(team_id, round_number, filename, content_type, uploaded_at, raw_data) VALUES ($1,$2,$3,$4,$5,$6::jsonb)',
      [item.teamId, item.round, item.filename, item.contentType, item.uploadedAt, item.rawData],
    )
    for (const item of unmapped) await client.query(
      'INSERT INTO migration_unmapped_documents(document_path, data) VALUES ($1,$2::jsonb)', [item.path, item.data],
    )

    const checksum = createHash('sha256').update(backupBytes).digest('hex')
    await client.query(
      `INSERT INTO migration_metadata(key, value) VALUES
        ('firestore_import', $1::jsonb), ('firestore_backup_sha256', $2::jsonb)`,
      [JSON.stringify(summary), JSON.stringify(checksum)],
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
  console.log('Import committed to PostgreSQL.')
  console.log(JSON.stringify(summary, null, 2))
} finally {
  client.release()
  await pool.end()
}
