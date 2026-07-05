import { KNOWN_EXAMPLE_VALUES } from './rules'

/** Substrings in an identifier name or file path that suggest "not a live secret". */
export const DOWNGRADE_KEYWORDS = ['example', 'fake', 'mock', 'dummy', 'sample', 'placeholder', 'demo', 'test']

const TEST_PATH_SEGMENT_RE = /(^|[\\/])(__tests__|__mocks__|fixtures?)([\\/]|$)/i
const TEST_FILENAME_RE = /(\.(test|spec)\.|(^|[\\/])test_|_test\.)/i

export function isTestFilePath(filePath: string): boolean {
  return TEST_PATH_SEGMENT_RE.test(filePath) || TEST_FILENAME_RE.test(filePath)
}

export function containsDowngradeKeyword(value: string): boolean {
  const lower = value.toLowerCase()
  return DOWNGRADE_KEYWORDS.some((kw) => lower.includes(kw))
}

/** Best-effort, per-line comment marker check — no block-comment/tree-sitter support until M5. */
const LINE_COMMENT_MARKERS = ['//', '#', '--', ';', '%']

export function isCommentLine(line: string): boolean {
  const trimmed = line.trimStart()
  return LINE_COMMENT_MARKERS.some((marker) => trimmed.startsWith(marker))
}

/**
 * Looks at the text immediately before `matchStart` for an assignment shape
 * (`identifier = ` / `identifier: `) and returns the identifier name, or null.
 * No real parser (tree-sitter arrives with the M5 chunker) — this is a
 * pragmatic heuristic that covers straightforward assignments only.
 */
export function identifierHint(text: string, matchStart: number): string | null {
  const before = text.slice(Math.max(0, matchStart - 80), matchStart)
  const match = /['"]?([A-Za-z_$][\w$]*)['"]?\s*[:=]\s*['"`]?$/.exec(before)
  return match ? match[1] : null
}

export function isKnownExampleValue(token: string, ruleId: string | null): boolean {
  if (KNOWN_EXAMPLE_VALUES.has(token)) return true
  if (ruleId === 'aws-access-token' && token.includes('EXAMPLE')) return true
  return false
}
