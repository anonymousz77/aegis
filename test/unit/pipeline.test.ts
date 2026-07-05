import { describe, expect, it } from 'vitest'
import { scan } from '../../src/secrets/pipeline'
import { AWS_DOC_EXAMPLE_KEY, FAKE_AWS_KEY, FAKE_HIGH_ENTROPY_TOKEN, FAKE_JWT } from '../helpers/fakeSecrets'

const FILE = { filePath: '/repo/src/config.ts' }
const TEST_FILE = { filePath: '/repo/src/__tests__/config.test.ts' }

describe('scan', () => {
  it('flags a fake AWS key as HIGH in plain context', () => {
    const text = `const awsAccessKeyId = "${FAKE_AWS_KEY}"`
    const findings = scan(text, FILE)
    const finding = findings.find((f) => f.ruleId === 'aws-access-token')
    expect(finding).toBeDefined()
    expect(finding!.severity).toBe('high')
  })

  it('downgrades one level when the identifier suggests a fake value', () => {
    const text = `const fakeAwsKey = "${FAKE_AWS_KEY}"`
    const findings = scan(text, FILE)
    const finding = findings.find((f) => f.ruleId === 'aws-access-token')
    expect(finding!.severity).toBe('medium')
    expect(finding!.signals).toContain('identifier_hint')
  })

  it('downgrades one level in a test file, stacking with identifier hint', () => {
    const text = `const fakeAwsKey = "${FAKE_AWS_KEY}"`
    const findings = scan(text, TEST_FILE)
    const finding = findings.find((f) => f.ruleId === 'aws-access-token')
    expect(finding!.severity).toBe('low')
    expect(finding!.signals).toEqual(expect.arrayContaining(['identifier_hint', 'is_test_file']))
  })

  it('forces the known AWS example key to LOW regardless of context', () => {
    const text = `const awsAccessKeyId = "${AWS_DOC_EXAMPLE_KEY}"`
    const findings = scan(text, FILE)
    const finding = findings.find((f) => f.ruleId === 'aws-access-token')
    expect(finding!.severity).toBe('low')
    expect(finding!.signals).toContain('known_example_value')
  })

  it('caps an entropy-only base64 candidate at MEDIUM (no rule match)', () => {
    const text = `const token = "${FAKE_HIGH_ENTROPY_TOKEN}"`
    const findings = scan(text, FILE)
    const finding = findings.find((f) => f.ruleId === null)
    expect(finding).toBeDefined()
    expect(finding!.severity).toBe('medium')
  })

  it('does not downgrade severity for being in a comment alone', () => {
    const text = `// const awsAccessKeyId = "${FAKE_AWS_KEY}"`
    const findings = scan(text, FILE)
    const finding = findings.find((f) => f.ruleId === 'aws-access-token')
    expect(finding!.severity).toBe('high')
    expect(finding!.signals).toContain('is_comment')
  })

  it('produces zero findings for clean text', () => {
    const text = 'function add(a, b) { return a + b }\nconst timeout = 5000\n'
    expect(scan(text, FILE)).toHaveLength(0)
  })

  it('does not double-report a rule-matched span as an entropy finding too', () => {
    const text = `const jwt = "${FAKE_JWT}"`
    const findings = scan(text, FILE)
    expect(findings.filter((f) => f.ruleId === 'jwt')).toHaveLength(1)
    expect(findings.filter((f) => f.ruleId === null)).toHaveLength(0)
  })

  it('never lets severity fall below low (floor)', () => {
    const text = `const fakeMockDummyExampleKey = "${FAKE_AWS_KEY}"`
    const findings = scan(text, TEST_FILE)
    const finding = findings.find((f) => f.ruleId === 'aws-access-token')
    expect(finding!.severity).toBe('low')
  })
})
