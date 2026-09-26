import { createServer } from 'node:http'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
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
const round3PhotoDirectory = resolve('local-data', 'round3-photos')
const round7PhotoDirectory = resolve('local-data', 'round7-photos')
const mimeTypes = { '.css': 'text/css', '.html': 'text/html', '.ico': 'image/x-icon', '.js': 'text/javascript', '.json': 'application/json', '.pdf': 'application/pdf', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' }

const send = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(data))
}

async function readJson(req, maxBytes = 64_000) {
  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > maxBytes) throw Object.assign(new Error('Request is too large.'), { status: 413 })
  }
  try { return JSON.parse(raw || '{}') } catch { throw Object.assign(new Error('Invalid JSON request.'), { status: 400 }) }
}

async function readBinary(req, maxBytes = 20 * 1024 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxBytes) throw Object.assign(new Error('Photo must be 20 MB or smaller.'), { status: 413 })
    chunks.push(chunk)
  }
  if (!size) throw Object.assign(new Error('Choose a photo before requesting review.'), { status: 400 })
  return Buffer.concat(chunks, size)
}

const keyFor = value => Buffer.from(value.trim().toLowerCase(), 'utf8').toString('base64url')
const cleanTeam = data => ({ id: data.id, name: data.name, members: data.members, progress: data.progress || 0, registeredAt: data.registeredAt, lastActivityAt: data.lastActivityAt ?? data.registeredAt, round3RequestedAt: data.round3RequestedAt ?? null, round3PhotoSubmittedAt: data.round3PhotoSubmittedAt ?? null, round3RejectedAt: data.round3RejectedAt ?? null, round3ApprovedAt: data.round3ApprovedAt ?? null, round4CluePassword: data.round4CluePassword ?? data.round3CluePassword ?? null, round7RequestedAt: data.round7RequestedAt ?? null, round7PhotoSubmittedAt: data.round7PhotoSubmittedAt ?? null, round7RejectedAt: data.round7RejectedAt ?? null, round7ApprovedAt: data.round7ApprovedAt ?? null })
const checkOrganizer = body => body?.username === adminUsername && body?.password === adminPassword

async function handleApi(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/health') {
    await db.doc('system/teamRegistration').get()
    return send(res, 200, { ok: true, database: 'connected', round3PhotoReview: true })
  }
  if (req.method === 'GET' && pathname === '/api/event-status') {
    const [eventState, teamSnapshot] = await Promise.all([
      db.doc('system/eventState').get(),
      db.collection('teams').get(),
    ])
    const winners = teamSnapshot.docs
      .filter(teamDoc => Boolean(teamDoc.data().round7ApprovedAt))
      .map(teamDoc => ({ id: teamDoc.id, name: teamDoc.data().name, approvedAt: teamDoc.data().round7ApprovedAt }))
      .sort((a, b) => String(a.approvedAt).localeCompare(String(b.approvedAt)))
    return send(res, 200, { gameOver: Boolean(eventState.data()?.gameOver), winners })
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' })
  if (pathname === '/api/team/request-round3-review') {
    const teamId = String(req.headers['x-team-id'] || '').trim().toLowerCase()
    const password = String(req.headers['x-team-password'] || '')
    const contentType = String(req.headers['content-type'] || '').split(';')[0].toLowerCase()
    if (!/^eqth\d{2,}$/.test(teamId) || !password) return send(res, 401, { error: 'Team login is required to request Round 3 review.' })
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) return send(res, 400, { error: 'Choose a JPG, PNG, or WEBP location photo.' })
    const photoBytes = await readBinary(req)
    const validImage = contentType === 'image/jpeg'
      ? photoBytes[0] === 0xff && photoBytes[1] === 0xd8 && photoBytes[2] === 0xff
      : contentType === 'image/png'
        ? photoBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : photoBytes.toString('ascii', 0, 4) === 'RIFF' && photoBytes.toString('ascii', 8, 12) === 'WEBP'
    if (!validImage) return send(res, 400, { error: 'The selected file does not match its image format.' })
    const teamRef = db.doc(`teams/${teamId}`)
    const currentTeam = await teamRef.get()
    if (!currentTeam.exists || currentTeam.data().password !== password) return send(res, 401, { error: 'Team login is required to request Round 3 review.' })
    if ((currentTeam.data().progress || 0) < 2) return send(res, 409, { error: 'Complete Round 2 before requesting Round 3 location review.' })
    const slotState = await db.doc('system/round3Slots').get()
    if (slotState.data()?.full) return send(res, 409, { error: 'You’re eliminated. The 10 slots for the next round are full.' })
    if (currentTeam.data().round3ApprovedAt || (currentTeam.data().progress || 0) >= 3) return send(res, 409, { error: 'Your Round 3 location has already been approved.' })

    const extension = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png' : 'webp'
    const filename = `${teamId}.${extension}`
    const targetPath = resolve(round3PhotoDirectory, filename)
    await mkdir(round3PhotoDirectory, { recursive: true })
    const temporaryPath = resolve(round3PhotoDirectory, `${teamId}.${Date.now()}.upload`)
    await writeFile(temporaryPath, photoBytes)
    await rename(temporaryPath, targetPath)
    const requestedAt = new Date().toISOString()
    try {
      const actualRequestedAt = await db.runTransaction(async tx => {
        const snapshot = await tx.get(teamRef)
        if (!snapshot.exists || snapshot.data().password !== password) throw Object.assign(new Error('Team login is required to request Round 3 review.'), { status: 401 })
        const data = snapshot.data()
        const slotState = await tx.get(db.doc('system/round3Slots'))
        if (slotState.data()?.full) throw Object.assign(new Error('You’re eliminated. The 10 slots for the next round are full.'), { status: 409 })
        if ((data.progress || 0) < 2) throw Object.assign(new Error('Complete Round 2 before requesting Round 3 location review.'), { status: 409 })
        if (data.round3ApprovedAt || (data.progress || 0) >= 3) throw Object.assign(new Error('Your Round 3 location has already been approved.'), { status: 409 })
        const nextRequestedAt = data.round3RequestedAt && !data.round3RejectedAt ? data.round3RequestedAt : requestedAt
        tx.set(db.doc(`round3PhotoProofs/${teamId}`), { teamId, filename, contentType, uploadedAt: requestedAt })
        tx.update(teamRef, { round3RequestedAt: nextRequestedAt, round3PhotoSubmittedAt: requestedAt, round3RejectedAt: null, round3PhotoContentType: contentType, round3PhotoFilename: filename, lastActivityAt: requestedAt })
        return nextRequestedAt
      })
      const previousFilename = currentTeam.data().round3PhotoFilename
      if (previousFilename && previousFilename !== filename && /^eqth\d{2,}\.(jpg|png|webp)$/.test(previousFilename)) {
        await rm(resolve(round3PhotoDirectory, previousFilename), { force: true }).catch(() => undefined)
      }
      return send(res, 200, { ok: true, requestedAt: actualRequestedAt })
    } catch (error) {
      await rm(targetPath, { force: true }).catch(() => undefined)
      throw error
    }
  }

  if (pathname === '/api/team/request-round7-review') {
    const teamId = String(req.headers['x-team-id'] || '').trim().toLowerCase()
    const password = String(req.headers['x-team-password'] || '')
    const contentType = String(req.headers['content-type'] || '').split(';')[0].toLowerCase()
    if (!/^eqth\d{2,}$/.test(teamId) || !password) return send(res, 401, { error: 'Team login is required to request final-round review.' })
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) return send(res, 400, { error: 'Choose a JPG, PNG, or WEBP treasure photo.' })
    const photoBytes = await readBinary(req)
    const validImage = contentType === 'image/jpeg'
      ? photoBytes[0] === 0xff && photoBytes[1] === 0xd8 && photoBytes[2] === 0xff
      : contentType === 'image/png'
        ? photoBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : photoBytes.toString('ascii', 0, 4) === 'RIFF' && photoBytes.toString('ascii', 8, 12) === 'WEBP'
    if (!validImage) return send(res, 400, { error: 'The selected file does not match its image format.' })
    const teamRef = db.doc(`teams/${teamId}`)
    const currentTeam = await teamRef.get()
    if (!currentTeam.exists || currentTeam.data().password !== password) return send(res, 401, { error: 'Team login is required to request final-round review.' })
    if ((currentTeam.data().progress || 0) < 6) return send(res, 409, { error: 'Complete Round 6 before requesting final-round review.' })
    if (currentTeam.data().round7ApprovedAt) return send(res, 409, { error: 'Your final-round result has already been approved.' })
    if (currentTeam.data().round7RequestedAt && !currentTeam.data().round7RejectedAt) return send(res, 409, { error: 'Your final-round photo is already waiting for organiser review.' })

    const extension = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png' : 'webp'
    const filename = `${teamId}.${extension}`
    await mkdir(round7PhotoDirectory, { recursive: true })
    const targetPath = resolve(round7PhotoDirectory, filename)
    const temporaryPath = resolve(round7PhotoDirectory, `${teamId}.${Date.now()}.upload`)
    await writeFile(temporaryPath, photoBytes)
    await rename(temporaryPath, targetPath)
    const requestedAt = new Date().toISOString()
    try {
      const actualRequestedAt = await db.runTransaction(async tx => {
        const snapshot = await tx.get(teamRef)
        if (!snapshot.exists || snapshot.data().password !== password) throw Object.assign(new Error('Team login is required to request final-round review.'), { status: 401 })
        const data = snapshot.data()
        if ((data.progress || 0) < 6) throw Object.assign(new Error('Complete Round 6 before requesting final-round review.'), { status: 409 })
        if (data.round7ApprovedAt) throw Object.assign(new Error('Your final-round result has already been approved.'), { status: 409 })
        if (data.round7RequestedAt && !data.round7RejectedAt) throw Object.assign(new Error('Your final-round photo is already waiting for organiser review.'), { status: 409 })
        tx.set(db.doc(`round7PhotoProofs/${teamId}`), { teamId, filename, contentType, uploadedAt: requestedAt })
        tx.update(teamRef, { round7RequestedAt: requestedAt, round7PhotoSubmittedAt: requestedAt, round7RejectedAt: null, round7PhotoFilename: filename, round7PhotoContentType: contentType, lastActivityAt: requestedAt })
        return requestedAt
      })
      const previousFilename = currentTeam.data().round7PhotoFilename
      if (previousFilename && previousFilename !== filename && /^eqth\d{2,}\.(jpg|png|webp)$/.test(previousFilename)) await rm(resolve(round7PhotoDirectory, previousFilename), { force: true }).catch(() => undefined)
      return send(res, 200, { ok: true, requestedAt: actualRequestedAt })
    } catch (error) {
      await rm(targetPath, { force: true }).catch(() => undefined)
      throw error
    }
  }

  const photoMatch = pathname.match(/^\/api\/admin\/round3-photo\/(eqth\d{2,})$/)
  if (photoMatch) {
    const body = await readJson(req)
    if (!checkOrganizer(body)) return send(res, 401, { error: 'Organiser login is required to view submitted photos.' })
    const teamId = photoMatch[1]
    const photoDoc = await db.doc(`round3PhotoProofs/${teamId}`).get()
    if (!photoDoc.exists) return send(res, 404, { error: 'No Round 3 photo is available for this team.' })
    const photo = photoDoc.data()
    if (!/^eqth\d{2,}\.(jpg|png|webp)$/.test(photo.filename || '') || !['image/jpeg', 'image/png', 'image/webp'].includes(photo.contentType)) return send(res, 404, { error: 'No valid Round 3 photo is available for this team.' })
    const photoPath = resolve(round3PhotoDirectory, photo.filename)
    if (!photoPath.startsWith(`${round3PhotoDirectory}${sep}`)) return send(res, 403, { error: 'Invalid photo path.' })
    const photoBytes = await readFile(photoPath).catch(() => null)
    if (!photoBytes) return send(res, 404, { error: 'The Round 3 photo is not available on this server.' })
    res.writeHead(200, { 'Content-Type': photo.contentType, 'Cache-Control': 'private, no-store', 'Content-Length': photoBytes.length })
    return res.end(photoBytes)
  }

  const finalPhotoMatch = pathname.match(/^\/api\/admin\/round7-photo\/(eqth\d{2,})$/)
  if (finalPhotoMatch) {
    const body = await readJson(req)
    if (!checkOrganizer(body)) return send(res, 401, { error: 'Organiser login is required to view submitted photos.' })
    const photoDoc = await db.doc(`round7PhotoProofs/${finalPhotoMatch[1]}`).get()
    if (!photoDoc.exists) return send(res, 404, { error: 'No final-round photo is available for this team.' })
    const photo = photoDoc.data()
    if (!/^eqth\d{2,}\.(jpg|png|webp)$/.test(photo.filename || '') || !['image/jpeg', 'image/png', 'image/webp'].includes(photo.contentType)) return send(res, 404, { error: 'No valid final-round photo is available for this team.' })
    const photoPath = resolve(round7PhotoDirectory, photo.filename)
    if (!photoPath.startsWith(`${round7PhotoDirectory}${sep}`)) return send(res, 403, { error: 'Invalid photo path.' })
    const photoBytes = await readFile(photoPath).catch(() => null)
    if (!photoBytes) return send(res, 404, { error: 'The final-round photo is not available on this server.' })
    res.writeHead(200, { 'Content-Type': photo.contentType, 'Cache-Control': 'private, no-store', 'Content-Length': photoBytes.length })
    return res.end(photoBytes)
  }

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
    const slotState = await db.doc('system/round3Slots').get()
    const eventState = await db.doc('system/eventState').get()
    return send(res, 200, { team: { ...cleanTeam(snapshot.data()), round3SlotsFull: Boolean(slotState.data()?.full), gameOver: Boolean(eventState.data()?.gameOver) } })
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
      if (snapshot.data().round3RejectedAt) throw Object.assign(new Error('The team must submit a new Round 3 review request before approval.'), { status: 409 })
      const existingCluePassword = snapshot.data().round4CluePassword || snapshot.data().round3CluePassword
      if (existingCluePassword && existingCluePassword !== cluePassword) throw Object.assign(new Error('This team already has a Round 4 clue password assigned.'), { status: 409 })
      const nextProgress = Math.max(currentProgress, 3)
      tx.update(teamRef, { progress: nextProgress, lastActivityAt: approvedAt, round3ApprovedAt: snapshot.data().round3ApprovedAt || approvedAt, round3RequestedAt: null, round3RejectedAt: null, round4CluePassword: cluePassword })
      return nextProgress
    })
    return send(res, 200, { ok: true, progress })
  }

  if (pathname === '/api/admin/round3-reject') {
    if (!checkOrganizer(body)) return send(res, 401, { error: 'Organiser login is required.' })
    const teamId = typeof body.teamId === 'string' ? body.teamId.trim().toLowerCase() : ''
    if (!/^eqth\d{2,}$/.test(teamId)) return send(res, 400, { error: 'Invalid team ID.' })
    const teamRef = db.doc(`teams/${teamId}`)
    const rejectedAt = new Date().toISOString()
    await db.runTransaction(async tx => {
      const snapshot = await tx.get(teamRef)
      if (!snapshot.exists) throw Object.assign(new Error('Team not found.'), { status: 404 })
      const data = snapshot.data()
      if ((data.progress || 0) < 2) throw Object.assign(new Error('The team must complete Round 2 before Round 3 can be reviewed.'), { status: 409 })
      if (data.round3ApprovedAt || (data.progress || 0) >= 3) throw Object.assign(new Error('An approved Round 3 result cannot be rejected.'), { status: 409 })
      tx.update(teamRef, { round3RequestedAt: null, round3RejectedAt: rejectedAt, lastActivityAt: rejectedAt, round4CluePassword: null })
    })
    return send(res, 200, { ok: true, rejectedAt })
  }

  if (pathname === '/api/admin/round3-slots-full') {
    if (!checkOrganizer(body)) return send(res, 401, { error: 'Organiser login is required.' })
    if (typeof body.full !== 'boolean') return send(res, 400, { error: 'Set whether the Round 3 next-round slots are full.' })
    await db.doc('system/round3Slots').set({ full: body.full, updatedAt: new Date().toISOString() })
    return send(res, 200, { ok: true, full: body.full })
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
      if (!data.round7RequestedAt && !data.round7ApprovedAt) throw Object.assign(new Error('The team must submit a final-round photo for review first.'), { status: 409 })
      const proof = await tx.get(db.doc(`round7PhotoProofs/${teamId}`))
      if (!proof.exists) throw Object.assign(new Error('The team must submit a final-round photo for review first.'), { status: 409 })
      tx.update(teamRef, { progress: 7, round7ApprovedAt: data.round7ApprovedAt || approvedAt, lastActivityAt: approvedAt })
      return 7
    })
    return send(res, 200, { ok: true, progress })
  }

  if (pathname === '/api/admin/round7-reject') {
    if (!checkOrganizer(body)) return send(res, 401, { error: 'Organiser login is required.' })
    const teamId = typeof body.teamId === 'string' ? body.teamId.trim().toLowerCase() : ''
    if (!/^eqth\d{2,}$/.test(teamId)) return send(res, 400, { error: 'Invalid team ID.' })
    const teamRef = db.doc(`teams/${teamId}`)
    const rejectedAt = new Date().toISOString()
    await db.runTransaction(async tx => {
      const snapshot = await tx.get(teamRef)
      if (!snapshot.exists) throw Object.assign(new Error('Team not found.'), { status: 404 })
      const data = snapshot.data()
      if ((data.progress || 0) < 6) throw Object.assign(new Error('The team must complete Round 6 before final-round review.'), { status: 409 })
      if (data.round7ApprovedAt || (data.progress || 0) >= 7) throw Object.assign(new Error('An approved final-round result cannot be rejected.'), { status: 409 })
      if (!data.round7RequestedAt) throw Object.assign(new Error('The team must submit a final-round photo before it can be rejected.'), { status: 409 })
      tx.update(teamRef, { round7RequestedAt: null, round7RejectedAt: rejectedAt, lastActivityAt: rejectedAt })
    })
    return send(res, 200, { ok: true, rejectedAt })
  }

  if (pathname === '/api/admin/game-over') {
    if (!checkOrganizer(body)) return send(res, 401, { error: 'Organiser login is required.' })
    if (typeof body.enabled !== 'boolean') return send(res, 400, { error: 'Set whether the game is over.' })
    await db.doc('system/eventState').set({ gameOver: body.enabled, gameOverUpdatedAt: new Date().toISOString() }, { merge: true })
    return send(res, 200, { ok: true, gameOver: body.enabled })
  }

  if (pathname === '/api/admin/teams') {
    if (!checkOrganizer(body)) return send(res, 401, { error: 'Organiser login is required.' })
    const snapshot = await db.collection('teams').get()
    const teams = await Promise.all(snapshot.docs.map(async teamDoc => {
      const data = teamDoc.data()
      let round3PhotoAvailable = false
      let round7PhotoAvailable = false
      let round3PhotoSubmittedAt = data.round3PhotoSubmittedAt ?? null
      const photoSnapshot = await db.doc(`round3PhotoProofs/${teamDoc.id}`).get()
      if (!round3PhotoSubmittedAt && photoSnapshot.exists) round3PhotoSubmittedAt = photoSnapshot.data().uploadedAt ?? null
      if (data.round3RequestedAt && !data.round3RejectedAt && !data.round3ApprovedAt) {
        round3PhotoAvailable = photoSnapshot.exists
      }
      const finalPhotoSnapshot = await db.doc(`round7PhotoProofs/${teamDoc.id}`).get()
      let round7PhotoSubmittedAt = data.round7PhotoSubmittedAt ?? null
      if (!round7PhotoSubmittedAt && finalPhotoSnapshot.exists) round7PhotoSubmittedAt = finalPhotoSnapshot.data().uploadedAt ?? null
      if ((data.round7RequestedAt || data.round7ApprovedAt) && finalPhotoSnapshot.exists) {
        round7PhotoAvailable = finalPhotoSnapshot.exists
      }
      return { ...cleanTeam(data), round3PhotoSubmittedAt, round3PhotoAvailable, round7PhotoSubmittedAt, round7PhotoAvailable }
    }))
    teams.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
    const slotState = await db.doc('system/round3Slots').get()
    const eventState = await db.doc('system/eventState').get()
    return send(res, 200, { teams, round3SlotsFull: Boolean(slotState.data()?.full), gameOver: Boolean(eventState.data()?.gameOver) })
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
