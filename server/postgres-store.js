const teamFieldColumns = {
  name: 'name',
  password: 'password',
  members: 'members',
  progress: 'progress',
  registeredAt: 'registered_at',
  lastActivityAt: 'last_activity_at',
  round3RequestedAt: 'round3_requested_at',
  round3PhotoSubmittedAt: 'round3_photo_submitted_at',
  round3RejectedAt: 'round3_rejected_at',
  round3ApprovedAt: 'round3_approved_at',
  round4CluePassword: 'round4_clue_password',
  round7RequestedAt: 'round7_requested_at',
  round7PhotoSubmittedAt: 'round7_photo_submitted_at',
  round7RejectedAt: 'round7_rejected_at',
  round7ApprovedAt: 'round7_approved_at',
}

const nameKeyFor = value => Buffer.from(String(value).trim().toLowerCase(), 'utf8').toString('base64url')
const splitPath = path => {
  const parts = path.split('/')
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error(`Unsupported PostgreSQL document path: ${path}`)
  return parts
}

class Snapshot {
  constructor(path, data) {
    this.ref = { path }
    this.id = path.split('/')[1]
    this.exists = data !== null
    this._data = data
  }
  data() { return this._data === null ? undefined : this._data }
}

class DocumentReference {
  constructor(store, path) {
    this.store = store
    this.path = path
    splitPath(path)
  }
  async get() { return this.store.readDocument(this.path) }
  async set(data, options = {}) { return this.store.writeDocument(this.path, 'set', data, options) }
  async update(data) { return this.store.writeDocument(this.path, 'update', data) }
  async create(data) { return this.store.writeDocument(this.path, 'create', data) }
  async delete() { return this.store.writeDocument(this.path, 'delete') }
}

class PostgresFirestoreStore {
  constructor(pool) { this.pool = pool }
  doc(path) { return new DocumentReference(this, path) }
  collection(name) {
    if (name !== 'teams') throw new Error(`Unsupported PostgreSQL collection: ${name}`)
    return { get: () => this.readTeamCollection() }
  }

  async readWithClient(client, path, lock = false) {
    const [collection, id] = splitPath(path)
    const lockClause = lock ? ' FOR UPDATE' : ''
    let result
    if (collection === 'teams') {
      result = await client.query(`SELECT raw_data FROM teams WHERE team_id = $1${lockClause}`, [id])
    } else if (collection === 'system') {
      result = await client.query(`SELECT data AS raw_data FROM system_state WHERE document_id = $1${lockClause}`, [id])
    } else if (collection === 'teamNames') {
      result = await client.query(`SELECT raw_data FROM team_names WHERE name_key = $1${lockClause}`, [id])
    } else if (collection === 'enrollments') {
      result = await client.query(`SELECT raw_data FROM enrollments WHERE enrollment_key = $1${lockClause}`, [id])
    } else if (collection === 'round3PhotoProofs' || collection === 'round7PhotoProofs') {
      const round = collection === 'round3PhotoProofs' ? 3 : 7
      result = await client.query(`SELECT raw_data FROM photo_proofs WHERE team_id = $1 AND round_number = $2${lockClause}`, [id, round])
    } else {
      throw new Error(`Unsupported PostgreSQL document collection: ${collection}`)
    }
    return new Snapshot(path, result.rowCount ? result.rows[0].raw_data : null)
  }

  async readDocument(path) {
    const client = await this.pool.connect()
    try { return await this.readWithClient(client, path) }
    finally { client.release() }
  }

  async readTeamCollection() {
    const result = await this.pool.query('SELECT team_id, raw_data FROM teams ORDER BY team_id')
    const docs = result.rows.map(row => new Snapshot(`teams/${row.team_id}`, row.raw_data))
    return { docs, size: docs.length, empty: docs.length === 0 }
  }

  async saveTeam(client, id, data) {
    const normalized = { ...data, id }
    if (typeof normalized.name !== 'string' || typeof normalized.password !== 'string') {
      throw new Error(`Team ${id} must include a name and password.`)
    }
    const values = [
      id, normalized.name, nameKeyFor(normalized.name), normalized.password,
      JSON.stringify(normalized.members || []), Number(normalized.progress || 0),
      normalized.registeredAt || new Date().toISOString(), normalized.lastActivityAt ?? null,
      normalized.round3RequestedAt ?? null, normalized.round3PhotoSubmittedAt ?? null,
      normalized.round3RejectedAt ?? null, normalized.round3ApprovedAt ?? null,
      normalized.round4CluePassword ?? normalized.round3CluePassword ?? null,
      normalized.round7RequestedAt ?? null, normalized.round7PhotoSubmittedAt ?? null,
      normalized.round7RejectedAt ?? null, normalized.round7ApprovedAt ?? null,
      JSON.stringify(normalized),
    ]
    await client.query(`INSERT INTO teams (
      team_id, name, name_key, password, members, progress, registered_at, last_activity_at,
      round3_requested_at, round3_photo_submitted_at, round3_rejected_at, round3_approved_at,
      round4_clue_password, round7_requested_at, round7_photo_submitted_at, round7_rejected_at,
      round7_approved_at, raw_data
    ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb)
    ON CONFLICT (team_id) DO UPDATE SET
      name = EXCLUDED.name, name_key = EXCLUDED.name_key, password = EXCLUDED.password,
      members = EXCLUDED.members, progress = EXCLUDED.progress, registered_at = EXCLUDED.registered_at,
      last_activity_at = EXCLUDED.last_activity_at, round3_requested_at = EXCLUDED.round3_requested_at,
      round3_photo_submitted_at = EXCLUDED.round3_photo_submitted_at,
      round3_rejected_at = EXCLUDED.round3_rejected_at, round3_approved_at = EXCLUDED.round3_approved_at,
      round4_clue_password = EXCLUDED.round4_clue_password, round7_requested_at = EXCLUDED.round7_requested_at,
      round7_photo_submitted_at = EXCLUDED.round7_photo_submitted_at,
      round7_rejected_at = EXCLUDED.round7_rejected_at, round7_approved_at = EXCLUDED.round7_approved_at,
      raw_data = EXCLUDED.raw_data`, values)
  }

  async writeWithClient(client, path, operation, data, options = {}, cache = new Map()) {
    const [collection, id] = splitPath(path)
    const previous = cache.get(path) ?? await this.readWithClient(client, path, collection === 'teams')
    if (operation === 'update' && !previous.exists) throw new Error(`Document ${path} does not exist.`)
    if (operation === 'create' && previous.exists) throw new Error(`Document ${path} already exists.`)
    if (operation === 'delete') {
      if (collection === 'teamNames') await client.query('DELETE FROM team_names WHERE name_key = $1', [id])
      else if (collection === 'enrollments') await client.query('DELETE FROM enrollments WHERE enrollment_key = $1', [id])
      else if (collection === 'teams') await client.query('DELETE FROM teams WHERE team_id = $1', [id])
      else if (collection === 'system') await client.query('DELETE FROM system_state WHERE document_id = $1', [id])
      else if (collection === 'round3PhotoProofs' || collection === 'round7PhotoProofs') {
        await client.query('DELETE FROM photo_proofs WHERE team_id = $1 AND round_number = $2', [id, collection === 'round3PhotoProofs' ? 3 : 7])
      }
      cache.set(path, new Snapshot(path, null))
      return
    }

    let merged = data || {}
    if (operation === 'update' || (operation === 'set' && options.merge && previous.exists)) {
      merged = { ...previous.data(), ...(data || {}) }
    }
    if (collection === 'teams') {
      await this.saveTeam(client, id, merged)
    } else if (collection === 'system') {
      const payload = JSON.stringify(merged)
      await client.query(`INSERT INTO system_state(document_id, data) VALUES ($1,$2::jsonb)
        ${operation === 'create' ? '' : 'ON CONFLICT (document_id) DO UPDATE SET data = EXCLUDED.data'}`, [id, payload])
    } else if (collection === 'teamNames') {
      await client.query(`INSERT INTO team_names(name_key, team_id, raw_data) VALUES ($1,$2,$3::jsonb)
        ${operation === 'create' ? '' : 'ON CONFLICT (name_key) DO UPDATE SET team_id = EXCLUDED.team_id, raw_data = EXCLUDED.raw_data'}`,
      [id, merged.teamId, JSON.stringify(merged)])
    } else if (collection === 'enrollments') {
      await client.query(`INSERT INTO enrollments(enrollment_key, team_id, raw_data) VALUES ($1,$2,$3::jsonb)
        ${operation === 'create' ? '' : 'ON CONFLICT (enrollment_key) DO UPDATE SET team_id = EXCLUDED.team_id, raw_data = EXCLUDED.raw_data'}`,
      [id, merged.teamId, JSON.stringify(merged)])
    } else if (collection === 'round3PhotoProofs' || collection === 'round7PhotoProofs') {
      const round = collection === 'round3PhotoProofs' ? 3 : 7
      const upsert = operation === 'create' ? '' : `ON CONFLICT (team_id, round_number) DO UPDATE SET
        filename = EXCLUDED.filename, content_type = EXCLUDED.content_type,
        uploaded_at = EXCLUDED.uploaded_at, raw_data = EXCLUDED.raw_data`
      await client.query(`INSERT INTO photo_proofs(team_id, round_number, filename, content_type, uploaded_at, raw_data)
        VALUES ($1,$2,$3,$4,$5,$6::jsonb)
        ${upsert}`,
      [id, round, merged.filename ?? null, merged.contentType ?? null, merged.uploadedAt ?? null, JSON.stringify(merged)])
    } else {
      throw new Error(`Unsupported PostgreSQL document collection: ${collection}`)
    }
    cache.set(path, new Snapshot(path, merged))
  }

  async writeDocument(path, operation, data, options = {}) {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      try {
        await this.writeWithClient(client, path, operation, data, options)
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    } finally { client.release() }
  }

  async runTransaction(callback) {
    const client = await this.pool.connect()
    const cache = new Map()
    const writes = []
    const transaction = {
      get: async reference => {
        const snapshot = await this.readWithClient(client, reference.path, true)
        cache.set(reference.path, snapshot)
        return snapshot
      },
      set: (reference, data, options) => writes.push({ path: reference.path, operation: 'set', data, options }),
      update: (reference, data) => writes.push({ path: reference.path, operation: 'update', data }),
      create: (reference, data) => writes.push({ path: reference.path, operation: 'create', data }),
      delete: reference => writes.push({ path: reference.path, operation: 'delete' }),
    }
    try {
      await client.query('BEGIN')
      try {
        const result = await callback(transaction)
        for (const write of writes) await this.writeWithClient(client, write.path, write.operation, write.data, write.options, cache)
        await client.query('COMMIT')
        return result
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    } finally { client.release() }
  }
}

export function createPostgresFirestoreStore(pool) {
  return new PostgresFirestoreStore(pool)
}
