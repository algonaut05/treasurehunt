import { completeTeamRound } from './api'

export async function recordRoundCompletion(round: number, cluePassword?: string) {
  const teamId = sessionStorage.getItem('engquest_team_id')
  const password = sessionStorage.getItem('engquest_team_password')
  if (!teamId || !password || sessionStorage.getItem('engquest_role') !== 'team') {
    throw new Error('Team login is required to save progress.')
  }
  return completeTeamRound(teamId, password, round, cluePassword)
}
