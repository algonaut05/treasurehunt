import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const port = Number(process.env.PORT || 3001)
const projectId = process.env.FIREBASE_PROJECT_ID
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT
const adminUsername = process.env.ADMIN_USERNAME
const adminPassword = process.env.ADMIN_PASSWORD

if (!projectId || !serviceAccountPath || !adminUsername || !adminPassword) {
  throw new Error('Set FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT, ADMIN_USERNAME, and ADMIN_PASSWORD in .env.local.')
}

const account = JSON.parse(await readFile(resolve(serviceAccountPath), 'utf8'))
initializeApp({ credential: cert(account), projectId })
const db = getFirestore()
const mimeTypes = { '.css': 'text/css', '.html': 'text/html', '.ico': 'image/x-icon', '.js': 'text/javascript', '.json': 'application/json', '.pdf': 'application/pdf', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' }

const send = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(data))
}

async function readJson(req) {
  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > 64_000) throw Object.assign(new Error('Request is too large.'), { status: 413 })
  }
  try { return JSON.parse(raw || '{}') } catch { throw Object.assign(new Error('Invalid JSON request.'), { status: 400 }) }
}

const keyFor = value => Buffer.from(value.trim().toLowerCase(), 'utf8').toString('base64url')
const cleanTeam = data => ({ id: data.id, name: data.name, members: data.members, progress: data.progress || 0, registeredAt: data.registeredAt, lastActivityAt: data.lastActivityAt ?? data.registeredAt, round3ApprovedAt: data.round3ApprovedAt ?? null, round4CluePassword: data.round4CluePassword ?? data.round3CluePassword ?? null, round7RequestedAt: data.round7RequestedAt ?? null, round7ApprovedAt: data.round7ApprovedAt ?? null })
const checkOrganizer = body => body?.username === adminUsername && body?.password === adminPassword

async function handleApi(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/health') {
    await db.doc('system/teamRegistration').get()
    return send(res, 200, { ok: true, database: 'connected' })
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' })
  const body = await readJson(req)

  if (pathname === '/api/register') {
    const { name, password, members } = body
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) return send(res, 400, { error: 'Enter a team name between 2 and 80 characters.' })
    if (typeof password !== 'string' || password.length < 4 || password.length > 128) return send(res, 400, { error: 'Team password must be at least 4 characters.' })
    if (!Array.isArray(members) || members.length !== 3 || members.some(member => !member?.name?.trim() || !member?.enrollment?.trim())) return send(res, 400, { error: 'Enter a name and enrollment number for all three members.' })
    const cleanMembers = members.map(member => ({ name: String(member.name).trim(), enrollment: String(member.enrollment).trim() }))
    const enrollmentKeys = cleanMembers.map(member => keyFor(member.enrollment))
    if (new Set(enrollmentKeys).size !== enrollmentKeys.length) return send(res, 400, { error: 'Each team member must have a different enrollment number.' })

    const cleanName = name.trim()
    const nameRef = db.doc(`teamNames/${keyFor(cleanName)}`)
    const enrollmentRefs = enrollmentKeys.map(key => db.doc(`enrollments/${key}`))
    const counterRef = db.doc('system/teamRegistration')
    let teamId
    try {
      await db.runTransaction(async tx => {
        const refs = [counterRef, nameRef, ...enrollmentRefs]
        const snapshots = await Promise.all(refs.map(ref => tx.get(ref)))
        if (snapshots.slice(1).some(snapshot => snapshot.exists)) throw Object.assign(new Error('That team name or an enrollment number is already registered.'), { status: 409 })
        const next = (snapshots[0].data()?.lastNumber || 0) + 1
        teamId = `eqth${String(next).padStart(2, '0')}`
        tx.set(counterRef, { lastNumber: next })
        tx.create(nameRef, { teamId })
        enrollmentRefs.forEach(ref => tx.create(ref, { teamId }))
      })
      const registeredAt = new Date().toISOString()
      await db.doc(`teams/${teamId}`).set({ id: teamId, name: cleanName, password, members: cleanMembers, progress: 0, registeredAt, lastActivityAt: registeredAt, round4CluePassword: null })
      return send(res, 201, { teamId })
    } catch (error) {
      if (teamId) await db.runTransaction(async tx => {
        const refs = [nameRef, ...enrollmentRefs]
        const snapshots = await Promise.all(refs.map(ref => tx.get(ref)))
        snapshots.forEach((snapshot, index) => { if (snapshot.exists && snapshot.data().teamId === teamId) tx.delete(refs[index]) })
      }).catch(() => undefined)
      throw error
    }
  }

  if (pathname === '/api/team-login') {
    const teamId = typeof body.teamId === 'string' ? body.teamId.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!/^eqth\d{2,}$/.test(teamId) || !password) return send(res, 401, { error: 'Team ID or password is incorrect.' })
    const snapshot = await db.doc(`teams/${teamId}`).get()
    if (!snapshot.exists || snapshot.data().password !== password) return send(res, 401, { error: 'Team ID or password is incorrect.' })
    return send(res, 200, { team: cleanTeam(snapshot.data()) })
  }

  if (pathname === '/api/team/progress') {
    const teamId = typeof body.teamId === 'string' ? body.teamId.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const completedRound = Number(body.completedRound)
    const cluePassword = typeof body.cluePassword === 'string' ? body.cluePassword.trim().toUpperCase() : ''
    if (!/^eqth\d{2,}$/.test(teamId) || !password || !Number.isInteger(completedRound) || completedRound < 1 || completedRound > 7 || completedRound === 3) {
      return send(res, 400, { error: 'Invalid completed round.' })
    }
    const teamRef = db.doc(`teams/${teamId}`)
    const lastActivityAt = new Date().toISOString()
    const progress = await db.runTransaction(async tx => {
      const snapshot = await tx.get(teamRef)
      if (!snapshot.exists || snapshot.data().password !== password) throw Object.assign(new Error('Team login is required to update progress.'), { status: 401 })
      const currentProgress = snapshot.data().progress || 0
      if (completedRound === 4 && currentProgress < 3) throw Object.assign(new Error('An organiser must approve your Round 3 result before Round 4 can be completed.'), { status: 409 })
      const assignedRound4Password = snapshot.data().round4CluePassword || snapshot.data().round3CluePassword
      if (completedRound === 4 && (!assignedRound4Password || cluePassword !== assignedRound4Password)) throw Object.assign(new Error('Enter the three-character clue password given to your team after Round 3 approval.'), { status: 409 })
      if (completedRound > currentProgress + 1) throw Object.assign(new Error('Complete the previous round first. Round 3 completion is recorded by an organiser.'), { status: 409 })
      const nextProgress = Math.max(currentProgress, completedRound)
      tx.update(teamRef, { progress: nextProgress, lastActivityAt })
      return nextProgress
    })
    return send(res, 200, { ok: true, progress })
  }

  if (pathname === '/api/team/request-round7-review') {
    const teamId = typeof body.teamId === 'string' ? body.teamId.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!/^eqth\d{2,}$/.test(teamId) || !password) return send(res, 401, { error: 'Team login is required to request final-round review.' })
    const teamRef = db.doc(`teams/${teamId}`)
    const requestedAt = new Date().toISOString()
    await db.runTransaction(async tx => {
      const snapshot = await tx.get(teamRef)
      if (!snapshot.exists || snapshot.data().password !== password) throw Object.assign(new Error('Team login is required to request final-round review.'), { status: 401 })
      if ((snapshot.data().progress || 0) < 6) throw Object.assign(new Error('Complete Round 6 before requesting final-round review.'), { status: 409 })
      tx.update(teamRef, { round7RequestedAt: snapshot.data().round7RequestedAt || requestedAt, lastActivityAt: requestedAt })
    })
    return send(res, 200, { ok: true, requestedAt })
  }

  if (pathname === '/api/admin-login') {
    if (!checkOrganizer(body)) return send(res, 401, { error: 'Incorrect organiser username or password.' })
    return send(res, 200, { ok: true })
  }

  if (pathname === '/api/admin/round3-result') {
    if (!checkOrganizer(body)) return send(res, 401, { error: 'Organiser login is required.' })
    const teamId = typeof body.teamId === 'string' ? body.teamId.trim().toLowerCase() : ''
    const cluePassword = typeof body.cluePassword === 'string' ? body.cluePassword.trim().toUpperCase() : ''
    if (!/^eqth\d{2,}$/.test(teamId)) return send(res, 400, { error: 'Invalid team ID.' })
    if (!/^[A-Z0-9]{3}$/.test(cluePassword) || !['7Q2', 'M8A', '4ZK', 'P6R', 'X3T', '9LF', 'B5N', 'W2C', 'K7V', 'D4Y'].includes(cluePassword)) return send(res, 400, { error: 'Enter a valid three-character Round 4 clue password.' })
    const teamRef = db.doc(`teams/${teamId}`)
    const approvedAt = new Date().toISOString()
    const progress = await db.runTransaction(async tx => {
      const snapshot = await tx.get(teamRef)
      if (!snapshot.exists) throw Object.assign(new Error('Team not found.'), { status: 404 })
      const currentProgress = snapshot.data().progress || 0
      if (currentProgress < 2) throw Object.assign(new Error('The team must complete Round 2 before a Round 3 result can be recorded.'), { status: 409 })
      const existingCluePassword = snapshot.data().round4CluePassword || snapshot.data().round3CluePassword
      if (existingCluePassword && existingCluePassword !== cluePassword) throw Object.assign(new Error('This team already has a Round 4 clue password assigned.'), { status: 409 })
      const nextProgress = Math.max(currentProgress, 3)
      tx.update(teamRef, { progress: nextProgress, lastActivityAt: approvedAt, round3ApprovedAt: snapshot.data().round3ApprovedAt || approvedAt, round4CluePassword: cluePassword })
      return nextProgress
    })
    return send(res, 200, { ok: true, progress })
  }

  if (pathname === '/api/admin/round7-result') {
    if (!checkOrganizer(body)) return send(res, 401, { error: 'Organiser login is required.' })
    const teamId = typeof body.teamId === 'string' ? body.teamId.trim().toLowerCase() : ''
    if (!/^eqth\d{2,}$/.test(teamId)) return send(res, 400, { error: 'Invalid team ID.' })
    const teamRef = db.doc(`teams/${teamId}`)
    const approvedAt = new Date().toISOString()
    const progress = await db.runTransaction(async tx => {
      const snapshot = await tx.get(teamRef)
      if (!snapshot.exists) throw Object.assign(new Error('Team not found.'), { status: 404 })
      const data = snapshot.data()
      if ((data.progress || 0) < 6) throw Object.assign(new Error('The team must complete Round 6 before final-round approval.'), { status: 409 })
      if (!data.round7RequestedAt && !data.round7ApprovedAt) throw Object.assign(new Error('The team must request final-round photo review first.'), { status: 409 })
      tx.update(teamRef, { progress: 7, round7ApprovedAt: data.round7ApprovedAt || approvedAt, lastActivityAt: approvedAt })
      return 7
    })
    return send(res, 200, { ok: true, progress })
  }

  if (pathname === '/api/admin/teams') {
    if (!checkOrganizer(body)) return send(res, 401, { error: 'Organiser login is required.' })
    const snapshot = await db.collection('teams').get()
    const teams = snapshot.docs.map(team => cleanTeam(team.data())).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
    return send(res, 200, { teams })
  }

  return send(res, 404, { error: 'API endpoint not found.' })
}

const server = createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    if (requestUrl.pathname.startsWith('/api/')) return await handleApi(req, res, requestUrl.pathname)

    const distRoot = resolve('dist')
    const requested = requestUrl.pathname === '/' ? 'index.html' : decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '')
    let filePath = resolve(distRoot, requested)
    if (!filePath.startsWith(`${distRoot}${sep}`) && filePath !== resolve(distRoot, 'index.html')) return send(res, 403, { error: 'Forbidden.' })
    try { if (!(await stat(filePath)).isFile()) throw new Error('not a file') }
    catch { filePath = resolve(distRoot, 'index.html') }
    const content = await readFile(filePath)
    res.writeHead(200, { 'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream', 'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600' })
    res.end(content)
  } catch (error) {
    console.error(error)
    send(res, error.status || 500, { error: error.status ? error.message : 'Server error. Check the local server logs.' })
  }
})

server.listen(port, '127.0.0.1', () => console.log(`ENGQUEST server listening on http://localhost:${port}`))
