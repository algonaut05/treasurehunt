const baseUrl = process.env.ENGQUEST_API_URL || 'http://127.0.0.1:3002'
const username = process.env.ADMIN_USERNAME
const organizerPassword = process.env.ADMIN_PASSWORD
if (!username || !organizerPassword) throw new Error('Organizer credentials are missing from .env.local.')

const stamp = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
const teamName = `Workflow Test ${stamp}`
const teamPassword = `Test-${stamp}`
const members = ['A', 'B', 'C'].map((letter, index) => ({
  name: `Workflow Member ${letter}`,
  enrollment: `WF-${stamp}-${index + 1}`,
}))
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a+ioAAAAASUVORK5CYII=', 'base64')

async function request(path, { method = 'GET', body, headers } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(body instanceof Buffer ? {} : { 'content-type': 'application/json' }), ...headers },
    body: body instanceof Buffer ? body : body === undefined ? undefined : JSON.stringify(body),
  })
  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json') ? await response.json() : null
  if (!response.ok) throw new Error(`${method} ${path} returned HTTP ${response.status}: ${data?.error || response.statusText}`)
  return data
}

const organizerBody = { username, password: organizerPassword }
const teamHeaders = { 'x-team-password': teamPassword, 'content-type': 'image/png' }
let teamId
const completed = []

const health = await request('/api/health')
if (!health?.ok) throw new Error('The API health check failed.')

const registration = await request('/api/register', {
  method: 'POST', body: { name: teamName, password: teamPassword, members },
})
teamId = registration.teamId
completed.push(`registered ${teamId}`)

let login = await request('/api/team-login', { method: 'POST', body: { teamId, password: teamPassword } })
if (login.team?.progress !== 0) throw new Error('New team did not start at progress 0.')
completed.push('team login')

for (const round of [1, 2]) {
  const result = await request('/api/team/progress', {
    method: 'POST', body: { teamId, password: teamPassword, completedRound: round },
  })
  if (result.progress !== round) throw new Error(`Round ${round} progress check failed.`)
  completed.push(`round ${round}`)
}

await request('/api/team/request-round3-review', {
  method: 'POST', headers: { ...teamHeaders, 'x-team-id': teamId }, body: png,
})
completed.push('round 3 photo submitted')

await request('/api/admin/round3-result', {
  method: 'POST', body: { ...organizerBody, teamId, cluePassword: '7Q2' },
})
completed.push('round 3 approved')

for (const round of [4, 5, 6]) {
  const body = { teamId, password: teamPassword, completedRound: round }
  if (round === 4) body.cluePassword = '7Q2'
  const result = await request('/api/team/progress', { method: 'POST', body })
  if (result.progress !== round) throw new Error(`Round ${round} progress check failed.`)
  completed.push(`round ${round}`)
}

await request('/api/team/request-round7-review', {
  method: 'POST', headers: { ...teamHeaders, 'x-team-id': teamId }, body: png,
})
completed.push('round 7 photo submitted')

await request('/api/admin/round7-result', {
  method: 'POST', body: { ...organizerBody, teamId },
})
completed.push('round 7 approved')

login = await request('/api/team-login', { method: 'POST', body: { teamId, password: teamPassword } })
if (login.team?.progress !== 7 || !login.team.round7ApprovedAt) throw new Error('Final team login did not show an approved completed game.')

await request(`/api/admin/round3-photo/${teamId}`, { method: 'POST', body: organizerBody })
await request(`/api/admin/round7-photo/${teamId}`, { method: 'POST', body: organizerBody })

const organizerView = await request('/api/admin/teams', { method: 'POST', body: organizerBody })
const listedTeam = organizerView.teams?.find(team => team.id === teamId)
if (!listedTeam || listedTeam.progress !== 7 || !listedTeam.round7PhotoAvailable || !listedTeam.round7ApprovedAt) {
  throw new Error('Organizer view did not show the completed team and final-round approval.')
}

console.log(`Workflow passed for ${teamId}: ${completed.join(', ')}; final login and organizer review view verified.`)
