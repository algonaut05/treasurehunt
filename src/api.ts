export type TeamMember = { name: string; enrollment: string }
export type RegisteredTeam = { id: string; name: string; members: TeamMember[]; progress: number; registeredAt: string; lastActivityAt?: string; round3RequestedAt?: string | null; round3PhotoSubmittedAt?: string | null; round3RejectedAt?: string | null; round3SlotsFull?: boolean; round3ApprovedAt?: string | null; round3PhotoAvailable?: boolean; round4CluePassword?: string | null; round7RequestedAt?: string | null; round7PhotoSubmittedAt?: string | null; round7RejectedAt?: string | null; round7ApprovedAt?: string | null; round7PhotoAvailable?: boolean; gameOver?: boolean }

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await response.json().catch(() => ({})) as { error?: string } & T
  if (!response.ok) {
    if (response.status === 404 && path === 'team/request-round3-review') {
      throw new Error('The local API is outdated. Stop the ENGQUEST API server, start it again with Start ENGQUEST.bat, then retry your photo submission.')
    }
    throw new Error(result.error || `Request failed (${response.status})`)
  }
  return result
}

export const registerTeam = (data: { name: string; password: string; members: TeamMember[] }) =>
  post<{ teamId: string }>('register', data)

export const teamLogin = (teamId: string, password: string) =>
  post<{ team: RegisteredTeam }>('team-login', { teamId, password })

export const getEventStatus = async () => {
  const response = await fetch('/api/event-status', { cache: 'no-store' })
  if (!response.ok) throw new Error(`Could not load event status (${response.status})`)
  return await response.json() as { gameOver: boolean; winners: { id: string; name: string; approvedAt: string }[] }
}

export const completeTeamRound = (teamId: string, password: string, completedRound: number, cluePassword?: string) =>
  post<{ ok: true; progress: number }>('team/progress', { teamId, password, completedRound, cluePassword })

export const organizerLogin = (username: string, password: string) =>
  post<{ ok: true }>('admin-login', { username, password })

export const organizerTeams = (username: string, password: string) =>
  post<{ teams: RegisteredTeam[]; round3SlotsFull: boolean; gameOver: boolean }>('admin/teams', { username, password })

export const organizerApproveRound3 = (teamId: string, username: string, password: string, cluePassword: string) =>
  post<{ ok: true; progress: number }>('admin/round3-result', { teamId, username, password, cluePassword })

export const organizerRejectRound3 = (teamId: string, username: string, password: string) =>
  post<{ ok: true; rejectedAt: string }>('admin/round3-reject', { teamId, username, password })

export const organizerSetRound3SlotsFull = (full: boolean, username: string, password: string) =>
  post<{ ok: true; full: boolean }>('admin/round3-slots-full', { full, username, password })

export const requestRound3Review = async (teamId: string, password: string, photo: File) => {
  const response = await fetch('/api/team/request-round3-review', {
    method: 'POST',
    headers: { 'Content-Type': photo.type, 'X-Team-Id': teamId, 'X-Team-Password': password },
    body: photo,
  })
  const result = await response.json().catch(() => ({})) as { error?: string; requestedAt?: string }
  if (!response.ok) {
    if (response.status === 404) throw new Error('The local API is outdated. Stop the ENGQUEST API server, start it again with Start ENGQUEST.bat, then retry your photo submission.')
    throw new Error(result.error || `Request failed (${response.status})`)
  }
  return result as { ok: true; requestedAt: string }
}

export const organizerRound3Photo = async (teamId: string, username: string, password: string) => {
  const response = await fetch(`/api/admin/round3-photo/${encodeURIComponent(teamId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(result.error || `Could not load photo (${response.status})`)
  }
  return response.blob()
}

export const requestRound7Review = async (teamId: string, password: string, photo: File) => {
  const response = await fetch('/api/team/request-round7-review', {
    method: 'POST',
    headers: { 'Content-Type': photo.type, 'X-Team-Id': teamId, 'X-Team-Password': password },
    body: photo,
  })
  const result = await response.json().catch(() => ({})) as { error?: string; requestedAt?: string }
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`)
  return result as { ok: true; requestedAt: string }
}

export const organizerApproveRound7 = (teamId: string, username: string, password: string) =>
  post<{ ok: true; progress: number }>('admin/round7-result', { teamId, username, password })

export const organizerRejectRound7 = (teamId: string, username: string, password: string) =>
  post<{ ok: true; rejectedAt: string }>('admin/round7-reject', { teamId, username, password })

export const organizerSetGameOver = (enabled: boolean, username: string, password: string) =>
  post<{ ok: true; gameOver: boolean }>('admin/game-over', { enabled, username, password })

export const organizerRound7Photo = async (teamId: string, username: string, password: string) => {
  const response = await fetch(`/api/admin/round7-photo/${encodeURIComponent(teamId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(result.error || `Could not load photo (${response.status})`)
  }
  return response.blob()
}
