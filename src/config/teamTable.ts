// Team table storage for captured team names
// Simple in‑memory map persisted to sessionStorage for the duration of a session.
// In a production app this would be replaced by a backend API.

export interface TeamEntry {
  name: string
  code: string // the 10‑digit Round 1 code used for verification
  timestamp: string // ISO timestamp when the entry was recorded
}

// Load existing entries from sessionStorage (if any)
const stored = sessionStorage.getItem('engquest_team_table')
export const teamTable: Record<string, TeamEntry> = stored ? JSON.parse(stored) : {}

/** Add a team entry and persist the table */
export function addTeamEntry(entry: TeamEntry) {
  teamTable[entry.code] = entry
  sessionStorage.setItem('engquest_team_table', JSON.stringify(teamTable))
}

