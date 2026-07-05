import { describe, expect, it } from 'vitest'
import {
  classifyCharset,
  entropyThresholdFor,
  extractCandidateTokens,
  isHighEntropy,
  shannonEntropy,
} from '../../src/secrets/entropy'
import { AWS_DOC_EXAMPLE_SECRET } from '../helpers/fakeSecrets'

describe('shannonEntropy', () => {
  it('is 0 for a repeated-character string', () => {
    expect(shannonEntropy('a'.repeat(40))).toBe(0)
  })

  it('rates English prose HIGHER (naively) than a git SHA — the documented caveat', () => {
    const englishSentence = 'the quick brown fox jumps over the lazy dog near the river bank'
    const gitSha40Hex = 'ebd95b7d4a1f3c4d5e6f7890abcdef1234567890'
    expect(shannonEntropy(englishSentence)).toBeGreaterThan(shannonEntropy(gitSha40Hex))
  })

  it('measures known samples within tolerance', () => {
    expect(shannonEntropy('550e8400-e29b-41d4-a716-446655440000')).toBeCloseTo(3.391, 2)
    expect(shannonEntropy('ebd95b7d4a1f3c4d5e6f7890abcdef1234567890')).toBeCloseTo(3.94, 1)
  })
})

describe('classifyCharset', () => {
  it('classifies a pure hex string as hex', () => {
    expect(classifyCharset('ebd95b7d4a1f3c4d5e6f7890abcdef1234567890')).toBe('hex')
  })

  it('classifies a UUID (contains dashes) as generic, not hex', () => {
    expect(classifyCharset('550e8400-e29b-41d4-a716-446655440000')).toBe('generic')
  })

  it('classifies a base64-ish string as generic', () => {
    expect(classifyCharset(AWS_DOC_EXAMPLE_SECRET)).toBe('generic')
  })
})

describe('entropyThresholdFor', () => {
  it('is lower for hex than generic at the same length', () => {
    expect(entropyThresholdFor('hex', 40)).toBeLessThan(entropyThresholdFor('generic', 40))
  })

  it('decreases (or stays flat) as length grows within a charset', () => {
    const short = entropyThresholdFor('generic', 24)
    const mid = entropyThresholdFor('generic', 40)
    const long = entropyThresholdFor('generic', 80)
    expect(short).toBeGreaterThanOrEqual(mid)
    expect(mid).toBeGreaterThanOrEqual(long)
  })
})

describe('isHighEntropy', () => {
  it('rejects tokens under the minimum length regardless of content', () => {
    expect(isHighEntropy('AKIA1234')).toBe(false)
  })

  it('accepts a real-looking random base64 secret', () => {
    expect(isHighEntropy(AWS_DOC_EXAMPLE_SECRET)).toBe(true)
  })

  it('rejects a UUID (below the generic-charset threshold)', () => {
    expect(isHighEntropy('550e8400-e29b-41d4-a716-446655440000')).toBe(false)
  })

  it('rejects a low-entropy repeated string', () => {
    expect(isHighEntropy('a'.repeat(40))).toBe(false)
  })
})

describe('extractCandidateTokens', () => {
  it('extracts a quoted-string token with correct offsets', () => {
    const text = `const key = "${AWS_DOC_EXAMPLE_SECRET}"`
    const tokens = extractCandidateTokens(text)
    const found = tokens.find((t) => t.token === AWS_DOC_EXAMPLE_SECRET)
    expect(found).toBeDefined()
    expect(text.slice(found!.start, found!.end)).toBe(found!.token)
  })

  it('extracts a bare env-style assignment token', () => {
    const text = `SECRET_TOKEN=${AWS_DOC_EXAMPLE_SECRET}`
    const tokens = extractCandidateTokens(text)
    const found = tokens.find((t) => t.token === AWS_DOC_EXAMPLE_SECRET)
    expect(found).toBeDefined()
    expect(text.slice(found!.start, found!.end)).toBe(found!.token)
  })

  it('does not extract a multi-word quoted string', () => {
    const text = 'const greeting = "hello world, this is not a secret"'
    const tokens = extractCandidateTokens(text)
    expect(tokens.some((t) => t.token.includes(' '))).toBe(false)
  })
})
