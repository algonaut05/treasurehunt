export type TeamMember = { name: string; enrollment: string }
export type RegisteredTeam = { id: string; name: string; members: TeamMember[]; progress: number; registeredAt: string; lastActivityAt?: string; round3ApprovedAt?: string | null; round4CluePassword?: string | null; round7RequestedAt?: string | null; round7ApprovedAt?: string | null }

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await response.json().catch(() => ({})) as { error?: string } & T
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`)
  return result
}

export const registerTeam = (data: { name: string; password: string; members: TeamMember[] }) =>
  post<{ teamId: string }>('register', data)

export const teamLogin = (teamId: string, password: string) =>
  post<{ team: RegisteredTeam }>('team-login', { teamId, password })

export const completeTeamRound = (teamId: string, password: string, completedRound: number, cluePassword?: string) =>
  post<{ ok: true; progress: number }>('team/progress', { teamId, password, completedRound, cluePassword })

export const organizerLogin = (username: string, password: string) =>
  post<{ ok: true }>('admin-login', { username, password })

export const organizerTeams = (username: string, password: string) =>
  post<{ teams: RegisteredTeam[] }>('admin/teams', { username, password })

export const organizerApproveRound3 = (teamId: string, username: string, password: string, cluePassword: string) =>
  post<{ ok: true; progress: number }>('admin/round3-result', { teamId, username, password, cluePassword })

export const requestRound7Review = (teamId: string, password: string) =>
  post<{ ok: true; requestedAt: string }>('team/request-round7-review', { teamId, password })

export const organizerApproveRound7 = (teamId: string, username: string, password: string) =>
  post<{ ok: true; progress: number }>('admin/round7-result', { teamId, username, password })
