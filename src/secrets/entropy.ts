/** Below this length, entropy is too noisy a signal — rely on rules only. */
export const MIN_ENTROPY_TOKEN_LENGTH = 20

export type Charset = 'hex' | 'generic'

export interface CandidateToken {
  token: string
  start: number
  end: number
}

/** Shape a candidate secret token must have: no whitespace, no quotes. */
const TOKEN_SHAPE = /^[A-Za-z0-9+/=_.-]+$/

export function shannonEntropy(value: string): number {
  if (value.length === 0) return 0
  const counts = new Map<string, number>()
  for (const ch of value) counts.set(ch, (counts.get(ch) ?? 0) + 1)

  let entropy = 0
  for (const count of counts.values()) {
    const p = count / value.length
    entropy -= p * Math.log2(p)
  }
  return entropy
}

export function classifyCharset(token: string): Charset {
  return /^[0-9a-fA-F]+$/.test(token) ? 'hex' : 'generic'
}

/**
 * Bits/char thresholds, tuned by charset and length: hex tops out at 4.0
 * bits/char and real secrets are statistically indistinguishable from
 * hashes/SHAs/digests in that charset (~3.4-3.9 measured), so hex is capped
 * at a permissive floor and the caller never promotes it past LOW. Longer
 * strings tolerate a lower per-char bar since total entropy (bits/char *
 * length) is what actually matters for guessability.
 */
export function entropyThresholdFor(charset: Charset, length: number): number {
  if (charset === 'hex') {
    if (length < 32) return 3.6
    if (length < 64) return 3.5
    return 3.3
  }
  if (length < 32) return 4.3
  if (length < 64) return 4.0
  return 3.7
}

export function isHighEntropy(token: string): boolean {
  if (token.length < MIN_ENTROPY_TOKEN_LENGTH) return false
  const charset = classifyCharset(token)
  const threshold = entropyThresholdFor(charset, token.length)
  return shannonEntropy(token) >= threshold
}

/** Extracts quoted-string contents and bare `key=value`/`key: value` RHS tokens, with offsets. */
export function extractCandidateTokens(text: string): CandidateToken[] {
  const results: CandidateToken[] = []
  const seenSpans = new Set<string>()

  const addCandidate = (token: string, start: number, end: number): void => {
    if (!TOKEN_SHAPE.test(token) || token.length === 0) return
    const key = `${start}:${end}`
    if (seenSpans.has(key)) return
    seenSpans.add(key)
    results.push({ token, start, end })
  }

  const stringRe = /"([^"\r\n]*)"|'([^'\r\n]*)'|`([^`\r\n]*)`/g
  let match: RegExpExecArray | null
  while ((match = stringRe.exec(text))) {
    const content = match[1] ?? match[2] ?? match[3] ?? ''
    const start = match.index + 1
    addCandidate(content, start, start + content.length)
  }

  const assignRe = /[:=]\s*([A-Za-z0-9+/=_.-]{4,})/g
  while ((match = assignRe.exec(text))) {
    const token = match[1]
    const start = match.index + match[0].length - token.length
    addCandidate(token, start, start + token.length)
  }

  return results
}
