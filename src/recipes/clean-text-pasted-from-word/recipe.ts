import type { Recipe } from '../types'
import { step } from '../define'

/**
 * Step 3: Word list items. A bullet or number reaches the clipboard as a glyph and a tab.
 * Word's default bullets are · (level 1), o (level 2) and § (level 3: a Wingdings square
 * read in a text font), so each level keeps its own indent. The step before has already
 * trimmed every line, so the indents added here are the only ones left.
 */
const LISTS = [
  '# level 1 bullets: · or • and the gap after it become "- "',
  String.raw`s/^[•·](?:\t| +)/- /`,
  '# level 2 (o) and level 3 (§ or ▪) bullets are indented under it',
  String.raw`s/^o\t */  - /`,
  String.raw`s/^[§▪]\t */    - /`,
  '# numbered items keep their number and lose the tab: "1.<tab>Text" becomes "1. Text"',
  String.raw`s/^([0-9]+|[a-zA-Z]|[ivxIVX]+)([.)])\t */\1\2 /`,
].join('\n')

const recipe: Recipe = {
  slug: 'clean-text-pasted-from-word',
  name: 'Clean up text pasted from Microsoft Word',
  summary:
    'Paste text copied out of a Word document and get plain text that behaves: curly quotes and dashes undone, list bullets turned into hyphens, hidden hyphens and no-break spaces gone.',
  category: 'Writing & Marketing',
  primaryQuery: 'clean up text pasted from word',
  published: '2026-10-09',
  related: ['clean-chatgpt-text', 'fix-pdf-line-breaks'],
  steps: [
    step('hidden', 'remove_invisible', { mode: 'remove' },
      'Deletes optional hyphens (Ctrl+hyphen in Word), zero-width spaces and similar characters. They are invisible on screen but split words, so a search for kickoff misses Kick-off with an optional hyphen inside it.',
      { label: 'hidden characters' }),
    step('spacing', 'collapse_whitespace', { spaces: true, newlines: true, trim: true, tabsToSpaces: false, unicodeSpaces: true },
      'Turns no-break spaces into ordinary ones, collapses double spaces, trims each line and squeezes the blank lines left by empty paragraphs into one. Tabs inside a line stay, so a pasted table still splits into columns.',
      { label: 'spaces and blank lines' }),
    step('lists', 'sed', { script: LISTS, perLine: true },
      "Rewrites Word's list items, which arrive as a bullet glyph or number followed by a tab, as - bullets and 1. numbers. Second- and third-level bullets are indented under the first; this runs after the trim so the indents stay.",
      { label: 'bullets and numbered items' }),
    step('dashes', 'multi_replace', { rules: [['—', '--'], ['–', '-'], ['\u2011', '-']], regex: false, ignoreCase: false, applyOnce: false },
      "Reverses Word's AutoFormat: two hyphens typed between words became an em dash, and a spaced hyphen became an en dash. Both go back to what was typed, and non-breaking hyphens become plain ones.",
      { label: 'dashes back to hyphens' }),
    step('quotes', 'smart_quotes', { direction: 'to-straight', quotes: true, dashes: false, ellipsis: true, locale: 'en' },
      'Straightens curly double and single quotes, apostrophes included, and turns the one-character ellipsis back into three dots, so the text works in code, a shell, CSV and old systems.',
      { label: 'straight quotes' }),
  ],
  samples: [
    {
      id: 'meeting-notes',
      title: 'Meeting notes with bullets',
      input: 'Kick\u00ADoff notes – Q3 launch\n\nWe agreed the “phase one” scope—launch moves to March.  Dana’s team owns QA…\n\n\n\n·\tFinalize the vendor list\n·\tSend the draft to legal\no\tInclude the NDA\n§\tCheck clause 4\n',
      output: 'Kickoff notes - Q3 launch\n\nWe agreed the "phase one" scope--launch moves to March. Dana\'s team owns QA...\n\n- Finalize the vendor list\n- Send the draft to legal\n  - Include the NDA\n    - Check clause 4',
    },
    {
      id: 'numbered-steps',
      title: 'Numbered steps',
      input: '1.\tOpen the “Settings” page.\n2.\tSet the timeout to 30\u00A0seconds – not 60.\n3.\tSave… then restart the service\u200B.\u00A0\n',
      output: '1. Open the "Settings" page.\n2. Set the timeout to 30 seconds - not 60.\n3. Save... then restart the service.',
    },
    {
      id: 'command-in-runbook',
      title: 'Command copied from a runbook',
      input: 'Run this on the server:\n\ncurl ––silent -H “Accept: application/json” https://api.example.com/v1/status\n\nThe ‘status’ field should read “ok”.\u00A0\u00A0\n',
      output: 'Run this on the server:\n\ncurl --silent -H "Accept: application/json" https://api.example.com/v1/status\n\nThe \'status\' field should read "ok".',
    },
  ],
}
export default recipe
