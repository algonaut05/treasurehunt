import { createHash } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const backupDirectory = process.argv[2]
if (!backupDirectory) throw new Error('Usage: node scripts/verify-firestore-backup.mjs <backup-directory>')
const root = resolve(backupDirectory)
const [backupBytes, manifestBytes] = await Promise.all([
  readFile(join(root, 'firestore-backup.json')),
  readFile(join(root, 'manifest.json')),
])
const backup = JSON.parse(backupBytes.toString('utf8'))
const manifest = JSON.parse(manifestBytes.toString('utf8'))
const checksum = createHash('sha256').update(backupBytes).digest('hex')
if (checksum !== manifest.firestoreBackupSha256) throw new Error('Firestore backup checksum does not match its manifest.')
if (backup.format !== manifest.format || backup.documentCount !== manifest.documentCount) throw new Error('Backup metadata does not match its manifest.')

async function filesUnder(directory) {
  const result = new Map()
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      for (const [relative, details] of await filesUnder(path)) result.set(join(entry.name, relative), details)
    } else if (entry.isFile()) {
      const bytes = await readFile(path)
      result.set(entry.name, { size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
    }
  }
  return result
}

for (const directory of ['round3-photos', 'round7-photos']) {
  const source = await filesUnder(resolve('local-data', directory))
  const copied = await filesUnder(join(root, directory))
  if (source.size !== copied.size) throw new Error(`${directory}: backup file count differs from source.`)
  for (const [name, details] of source) {
    const copy = copied.get(name)
    if (!copy || copy.size !== details.size || copy.sha256 !== details.sha256) {
      throw new Error(`${directory}: backup verification failed for one image file.`)
    }
  }
}

console.log(`Verified ${backup.documentCount} Firestore documents across ${Object.keys(backup.collectionCounts).length} collections.`)
console.log('Both local photo directories match their backed-up copies.')
console.log(`SHA-256: ${checksum}`)
