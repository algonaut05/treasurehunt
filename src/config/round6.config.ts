import { base } from './clue.config';

/**
 * Round 6 Configuration
 * Contains settings for the 25-city NPC hunt
 */

export const round6Config = {
  // NPC settings
  npcImagePath: `${base}gameasset/npc.png?v=2`,
  requiredTaps: 10,

  // Map settings
  defaultZoom: 2,
  minZoom: 2,

  // Shared final clue for all teams that complete Round 6.
  finalPdfUrl: `${base}clues/M8A.pdf`,

  // Game timing
  targetTimeMinutes: 6, // 5-7 minutes as specified

  // UI strings
  ui: {
    roundTitle: 'ROUND 6: 25-CITY NPC HUNT',
    sectionKicker: 'THE FINAL CLUE',
    puzzleHint: "You've been collecting numbers, but you never asked the right question. The first letter of each city you visited, in order, forms a word.",
    enterWordPrompt: 'Enter the 25-letter word:',
    wordFormatHint: 'Example format: LPT CNR DSI SRS ABM AAM PBL KR (remove spaces)',
    checkButton: 'Submit Word',
    clearButton: 'Clear',
    pdfUnlockedTitle: 'FINAL CLUE UNLOCKED',
    pdfUnlockedMessage: 'Congratulations! You\'ve solved the 25-city NPC hunt and unlocked the final clue.',
    viewPdfButton: 'View Final Clue PDF',
    proceedToRound7: 'Proceed to Round 7',
    incorrectWordError: 'Incorrect word. Remember: first letter of each city you visited.',
    loadingText: 'Checking...',
    calculatingReward: 'Calculating your reward...'
  }
};
