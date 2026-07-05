import { SECRET_RULES, type Severity, isPlaceholderPassword } from './rules'
import { extractCandidateTokens, isHighEntropy, classifyCharset, shannonEntropy, type Charset } from './entropy'
import {
  isTestFilePath,
  isCommentLine,
  identifierHint,
  isKnownExampleValue,
  containsDowngradeKeyword,
} from './contextFeatures'

export interface Finding {
  ruleId: string | null
  vendor: string
  severity: Severity
  startOffset: number
  endOffset: number
  maskedPreview: string
  entropyBits?: number
  entropyBucket?: string
  signals: string[]
}

export interface ScanOptions {
  filePath: string
}

export const SEVERITY_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2 }

function stepDown(severity: Severity): Severity {
  if (severity === 'high') return 'medium'
  return 'low'
}

function maskPreview(token: string): string {
  if (token.length <= 6) return '•'.repeat(token.length)
  return token.slice(0, 2) + '•'.repeat(token.length - 4) + token.slice(-2)
}

function entropyBucketLabel(bits: number, charset: Charset): string {
  const max = charset === 'hex' ? 4.0 : 6.0
  const ratio = bits / max
  if (ratio >= 0.9) return 'very-high'
  if (ratio >= 0.75) return 'high'
  if (ratio >= 0.6) return 'moderate'
  return 'low'
}

function lineOf(text: string, offset: number): string {
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1
  const nextNewline = text.indexOf('\n', offset)
  const lineEnd = nextNewline === -1 ? text.length : nextNewline
  return text.slice(lineStart, lineEnd)
}

/** Applies the shared identifier/test-file/comment signals to a base severity. */
function applyContextualSignals(
  text: string,
  opts: ScanOptions,
  start: number,
  token: string,
  ruleId: string | null,
  baseSeverity: Severity
): { severity: Severity; signals: string[] } {
  const signals: string[] = []
  let severity = baseSeverity

  if (isKnownExampleValue(token, ruleId)) {
    severity = 'low'
    signals.push('known_example_value')
  } else {
    const identifier = identifierHint(text, start)
    if (identifier && containsDowngradeKeyword(identifier)) {
      severity = stepDown(severity)
      signals.push('identifier_hint')
    }
    if (isTestFilePath(opts.filePath)) {
      severity = stepDown(severity)
      signals.push('is_test_file')
    }
  }

  if (isCommentLine(lineOf(text, start))) {
    signals.push('is_comment')
  }

  return { severity, signals }
}

export function scan(text: string, opts: ScanOptions): Finding[] {
  const findings: Finding[] = []
  const coveredSpans: Array<[number, number]> = []

  for (const rule of SECRET_RULES) {
    rule.regex.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = rule.regex.exec(text))) {
      const token = match[0]
      const start = match.index
      const end = start + token.length
      coveredSpans.push([start, end])

      const { severity: contextSeverity, signals } = applyContextualSignals(
        text,
        opts,
        start,
        token,
        rule.id,
        rule.baseSeverity
      )

      let severity = contextSeverity
      if (rule.id === 'generic-uri-credential') {
        const password = match[1]
        if (password && isPlaceholderPassword(password) && !signals.includes('known_example_value')) {
          severity = 'low'
          signals.push('placeholder_password')
        }
      }

      findings.push({
        ruleId: rule.id,
        vendor: rule.vendor,
        severity,
        startOffset: start,
        endOffset: end,
        maskedPreview: maskPreview(token),
        signals,
      })
    }
  }

  const isCovered = (start: number, end: number): boolean =>
    coveredSpans.some(([coveredStart, coveredEnd]) => start < coveredEnd && end > coveredStart)

  for (const candidate of extractCandidateTokens(text)) {
    if (isCovered(candidate.start, candidate.end)) continue
    if (!isHighEntropy(candidate.token)) continue

    const charset = classifyCharset(candidate.token)
    const bits = shannonEntropy(candidate.token)
    const baseSeverity: Severity = charset === 'hex' ? 'low' : 'medium'

    const { severity, signals } = applyContextualSignals(text, opts, candidate.start, candidate.token, null, baseSeverity)

    findings.push({
      ruleId: null,
      vendor: `High-entropy ${charset} string (no vendor match)`,
      severity,
      startOffset: candidate.start,
      endOffset: candidate.end,
      maskedPreview: maskPreview(candidate.token),
      entropyBits: bits,
      entropyBucket: entropyBucketLabel(bits, charset),
      signals,
    })

    coveredSpans.push([candidate.start, candidate.end])
  }

  return findings.sort((a, b) => a.startOffset - b.startOffset)
}
