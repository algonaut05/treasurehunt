import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const projectId = process.env.FIREBASE_PROJECT_ID
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT
if (!projectId || !serviceAccountPath) {
  throw new Error('FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT must be set in .env.local.')
}

const account = JSON.parse(await readFile(resolve(serviceAccountPath), 'utf8'))
initializeApp({ credential: cert(account), projectId })
const db = getFirestore()

const encode = value => {
  if (value === null || value === undefined) return value ?? null
  if (value instanceof Date) return { $type: 'date', value: value.toISOString() }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { $type: 'bytes', base64: Buffer.from(value).toString('base64') }
  }
  if (typeof value?.toDate === 'function' && value.constructor?.name === 'Timestamp') {
    return { $type: 'timestamp', value: value.toDate().toISOString() }
  }
  if (typeof value?.path === 'string' && value.firestore) return { $type: 'reference', path: value.path }
  if (typeof value?.latitude === 'number' && typeof value?.longitude === 'number') {
    return { $type: 'geopoint', latitude: value.latitude, longitude: value.longitude }
  }
  if (Array.isArray(value)) return value.map(encode)
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]))
  return value
}

const documents = []
const collectionCounts = {}
async function exportCollection(collection) {
  const snapshot = await collection.get()
  collectionCounts[collection.path] = snapshot.size
  for (const document of snapshot.docs) {
    documents.push({ path: document.ref.path, data: encode(document.data()) })
    for (const childCollection of await document.ref.listCollections()) {
      await exportCollection(childCollection)
    }
  }
}

for (const collection of await db.listCollections()) await exportCollection(collection)

const suffix = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const backupDirectory = resolve('local-data', 'migration-backups', suffix)
await mkdir(backupDirectory, { recursive: true })
const backupFile = resolve(backupDirectory, 'firestore-backup.json')
const backup = {
  format: 'engquest-firestore-export-v1',
  projectId,
  exportedAt: new Date().toISOString(),
  collectionCounts,
  documentCount: documents.length,
  documents,
}
const backupBytes = Buffer.from(JSON.stringify(backup, null, 2))
await writeFile(backupFile, backupBytes, { mode: 0o600 })

for (const directory of ['round3-photos', 'round7-photos']) {
  try {
    await cp(resolve('local-data', directory), resolve(backupDirectory, directory), { recursive: true, errorOnExist: true })
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

const manifest = {
  format: backup.format,
  projectId,
  exportedAt: backup.exportedAt,
  collectionCounts,
  documentCount: documents.length,
  firestoreBackupSha256: createHash('sha256').update(backupBytes).digest('hex'),
  includesLocalPhotoDirectories: true,
}
await writeFile(resolve(backupDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 })
await writeFile(resolve(backupDirectory, '.gitignore'), '*\n!.gitignore\n', { mode: 0o600 })

console.log(`Exported ${documents.length} Firestore documents across ${Object.keys(collectionCounts).length} collections.`)
console.log(`Backup directory: ${backupDirectory}`)
console.log(`SHA-256: ${manifest.firestoreBackupSha256}`)
