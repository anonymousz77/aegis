import { describe, expect, it, vi, afterEach } from 'vitest'
import { scan } from '../../src/secrets/pipeline'
import {
  FAKE_AWS_KEY,
  FAKE_GITHUB_PAT,
  FAKE_GOOGLE_API_KEY,
  FAKE_SLACK_BOT_TOKEN,
  FAKE_STRIPE_LIVE_KEY,
} from '../helpers/fakeSecrets'

const RAW_SECRET_VALUES = [FAKE_AWS_KEY, FAKE_GITHUB_PAT, FAKE_SLACK_BOT_TOKEN, FAKE_STRIPE_LIVE_KEY, FAKE_GOOGLE_API_KEY]

function sampleTexts(): string[] {
  return [
    `AWS_ACCESS_KEY_ID=${FAKE_AWS_KEY}`,
    `GITHUB_TOKEN=${FAKE_GITHUB_PAT}`,
    `SLACK_BOT_TOKEN=${FAKE_SLACK_BOT_TOKEN}`,
    `STRIPE_LIVE=${FAKE_STRIPE_LIVE_KEY}`,
    `GOOGLE_API_KEY=${FAKE_GOOGLE_API_KEY}`,
  ]
}

describe('redaction', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('never puts the full raw value in maskedPreview', () => {
    for (const text of sampleTexts()) {
      const findings = scan(text, { filePath: 'x.env' })
      for (const finding of findings) {
        for (const raw of RAW_SECRET_VALUES) {
          expect(finding.maskedPreview).not.toContain(raw)
        }
      }
    }
  })

  it('masked preview never reveals more than the first/last 2 characters', () => {
    const text = `const key = "${FAKE_AWS_KEY}"`
    const findings = scan(text, { filePath: 'x.ts' })
    const finding = findings.find((f) => f.ruleId === 'aws-access-token')!
    expect(finding.maskedPreview).toBe('AK••••••••••••••••OP')
    expect(finding.maskedPreview).not.toBe(FAKE_AWS_KEY)
  })

  it('scanning never calls console.* with a raw secret value (belt-and-suspenders)', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    for (const text of sampleTexts()) {
      scan(text, { filePath: 'x.env' })
    }

    const allCalls = [...logSpy.mock.calls, ...errorSpy.mock.calls, ...warnSpy.mock.calls]
    for (const call of allCalls) {
      const stringified = call.map((arg) => String(arg)).join(' ')
      for (const raw of RAW_SECRET_VALUES) {
        expect(stringified).not.toContain(raw)
      }
    }
  })
})
