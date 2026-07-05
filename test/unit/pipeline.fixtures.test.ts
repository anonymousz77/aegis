import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { scan } from '../../src/secrets/pipeline'
import {
  FAKE_AWS_KEY,
  FAKE_GITHUB_PAT,
  FAKE_JWT,
  FAKE_PRIVATE_KEY_PEM,
  FAKE_SLACK_BOT_TOKEN,
  FAKE_STRIPE_LIVE_KEY,
  FAKE_GOOGLE_API_KEY,
  STRIPE_DOC_EXAMPLE_KEY,
} from '../helpers/fakeSecrets'

const FIXTURE_DIR = path.resolve(__dirname, '../fixtures/secrets')

/**
 * Only fixtures with NO vendor-token-shaped content live as static files —
 * AWS, GitHub, Slack, Stripe, and generic Private Key blocks are all
 * push-protected by GitHub's default patterns (checked against GitHub's own
 * supported-patterns docs), and match on prefix+length SHAPE, not checksum
 * validity, so even an obviously-fake body trips it. Those cases are
 * exercised below via in-memory-constructed strings instead (see
 * test/helpers/fakeSecrets.ts) — the disk-file mechanic itself isn't part of
 * what's being tested, only `scan()`'s behavior on the resulting text.
 *
 * The fixtures that DO remain live under test/fixtures/secrets/ on disk, but
 * that path itself contains "fixtures" — which `isTestFilePath` (correctly)
 * treats as a test-file signal. So we scan fixture content against a
 * synthetic path rather than the real disk path, to avoid self-downgrading.
 */
function scanFixture(relativePath: string): ReturnType<typeof scan> {
  const text = fs.readFileSync(path.join(FIXTURE_DIR, relativePath), 'utf-8')
  return scan(text, { filePath: `/repo/src/${relativePath}` })
}

describe('pipeline against in-memory constructed secrets (no vendor literal on disk)', () => {
  it('every vendor pattern fires at medium or above end-to-end', () => {
    const samples: Record<string, string> = {
      'aws-access-token': `AWS_ACCESS_KEY_ID=${FAKE_AWS_KEY}`,
      'github-pat': `GITHUB_TOKEN=${FAKE_GITHUB_PAT}`,
      'slack-bot-token': `SLACK_BOT_TOKEN=${FAKE_SLACK_BOT_TOKEN}`,
      'stripe-live-key': `STRIPE_LIVE=${FAKE_STRIPE_LIVE_KEY}`,
      'gcp-api-key': `GOOGLE_API_KEY=${FAKE_GOOGLE_API_KEY}`,
      jwt: `AUTH=${FAKE_JWT}`,
      'private-key': FAKE_PRIVATE_KEY_PEM,
    }
    for (const [ruleId, text] of Object.entries(samples)) {
      const findings = scan(text, { filePath: '/repo/src/secrets-sample.env' })
      const finding = findings.find((f) => f.ruleId === ruleId)
      expect(finding, ruleId).toBeDefined()
      expect(finding!.severity === 'high' || finding!.severity === 'medium', ruleId).toBe(true)
    }
  })

  it("forces Stripe's real published doc-example key to LOW end-to-end", () => {
    const text = `STRIPE_TEST_DOC_EXAMPLE=${STRIPE_DOC_EXAMPLE_KEY}`
    const findings = scan(text, { filePath: '/repo/src/stripe.env' })
    const testExample = findings.find((f) => f.ruleId === 'stripe-test-key')
    expect(testExample?.severity).toBe('low')
    expect(testExample?.signals).toContain('known_example_value')
  })

  it('downgrades a fake key below HIGH when the (synthetic) path signals a test file', () => {
    const findings = scan(`AWS_ACCESS_KEY_ID=${FAKE_AWS_KEY}`, {
      filePath: '/repo/src/__tests__/sample-with-fake-key.txt',
    })
    const finding = findings.find((f) => f.ruleId === 'aws-access-token')
    expect(finding).toBeDefined()
    expect(finding!.severity).not.toBe('high')
    expect(finding!.signals).toContain('is_test_file')
  })
})

describe('pipeline against committed fixtures (no vendor-token-shaped content)', () => {
  it('generic-uri.env flags a real embedded credential as HIGH', () => {
    const findings = scanFixture('generic-uri.env')
    const finding = findings.find((f) => f.ruleId === 'generic-uri-credential')
    expect(finding?.severity).toBe('high')
  })

  it('generic-uri-negatives.txt never fires HIGH (placeholders + non-matching shapes)', () => {
    const findings = scanFixture('generic-uri-negatives.txt')
    expect(findings.every((f) => f.severity !== 'high')).toBe(true)
  })

  it('hard-negatives.txt never fires HIGH', () => {
    const findings = scanFixture('hard-negatives.txt')
    expect(findings.every((f) => f.severity !== 'high')).toBe(true)
  })

  it('clean.txt produces zero findings', () => {
    expect(scanFixture('clean.txt')).toHaveLength(0)
  })
})
