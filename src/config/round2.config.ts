export interface Round2Archive {
  id: number
  password: string
  fileName: string
  title: string
  fileUrl: string
}

export const ROUND1_VALID_CODES = new Set([
  '0001000111', '1110101000', '1111101110', '0010011110', '1101110011',
  '1100111111', '0111011110', '0110011001', '0000111000', '1111011100',
  '1100011000', '0111001100', '1000100000', '0111111011', '1100011000',
  '0001111000', '0101100011', '1110100010', '1101010000', '0111111111',
  '0011100000', '1100000100', '1000101111', '1111111001', '0110010111',
  '1100111101', '0011000000', '1010000001', '0011000111', '1100111000',
  '1111100000', '1110110001', '0000001111', '0000000000', '1001111001',
  '0001110000', '0111101011', '1100111111', '1110001111', '1001111000',
  '0001100111', '1111100100', '1111101111',
]);

export const ROUND2_PASSWORDS: Record<string, { id: number; fileName: string; title: string }> = {
  'A7K2M': { id: 1,  fileName: 'archive_01.pdf', title: 'Archive Clue 01' },
  'B4R8Q': { id: 2,  fileName: 'archive_02.pdf', title: 'Archive Clue 02' },
  'C9T3L': { id: 3,  fileName: 'archive_03.pdf', title: 'Archive Clue 03' },
  'D5W1N': { id: 4,  fileName: 'archive_04.pdf', title: 'Archive Clue 04' },
  'E8P4X': { id: 5,  fileName: 'archive_05.pdf', title: 'Archive Clue 05' },
  'F2H7K': { id: 6,  fileName: 'archive_06.pdf', title: 'Archive Clue 06' },
  'G6M3R': { id: 7,  fileName: 'archive_07.pdf', title: 'Archive Clue 07' },
  'J4Q9T': { id: 8,  fileName: 'archive_08.pdf', title: 'Archive Clue 08' },
  'K8L2V': { id: 9,  fileName: 'archive_09.pdf', title: 'Archive Clue 09' },
  'M5N7C': { id: 10, fileName: 'archive_10.pdf', title: 'Archive Clue 10' },
  'P3R6Y': { id: 11, fileName: 'archive_11.pdf', title: 'Archive Clue 11' },
  'Q7T4B': { id: 12, fileName: 'archive_12.pdf', title: 'Archive Clue 12' },
  'R2V8H': { id: 13, fileName: 'archive_13.pdf', title: 'Archive Clue 13' },
  'S9K5D': { id: 14, fileName: 'archive_14.pdf', title: 'Archive Clue 14' },
  'T4X6M': { id: 15, fileName: 'archive_15.pdf', title: 'Archive Clue 15' },
}

export interface ValidationResult {
  valid: boolean
  archive?: Round2Archive
  error?: string
}

export function validateRound2Credentials(rawCode: string, rawPassword: string): ValidationResult {
  const code = (rawCode || '').trim()
  const password = (rawPassword || '').trim().toUpperCase()

  if (!code && !password) {
    return { valid: false, error: 'Please enter both the 10-digit Round 01 code and the Organizer password.' }
  }
  if (!code) {
    return { valid: false, error: 'Missing Round 01 code. Please enter your 10-digit code.' }
  }
  if (!password) {
    return { valid: false, error: 'Missing Organizer password. Please enter the password given by the organizer.' }
  }

  const isCodeValid = ROUND1_VALID_CODES.has(code)
  const archiveMeta = ROUND2_PASSWORDS[password]

  if (!isCodeValid && !archiveMeta) {
    return { valid: false, error: 'Both the 10-digit code and the organizer password are incorrect.' }
  }
  if (!isCodeValid) {
    return { valid: false, error: 'Invalid Round 01 code. Make sure it exactly matches your 10-digit key.' }
  }
  if (!archiveMeta) {
    return { valid: false, error: 'Invalid Organizer password. Please verify the 5-character key from your organizer.' }
  }

  return {
    valid: true,
    archive: {
      id: archiveMeta.id,
      password,
      fileName: archiveMeta.fileName,
      title: archiveMeta.title,
      fileUrl: `/pdfs/${archiveMeta.fileName}`,
    },
  }
}
