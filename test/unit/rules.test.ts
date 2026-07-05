import { describe, expect, it } from 'vitest'
import { SECRET_RULES, isPlaceholderPassword } from '../../src/secrets/rules'
import {
  FAKE_AWS_KEY,
  FAKE_GITHUB_PAT,
  FAKE_JWT,
  FAKE_PRIVATE_KEY_PEM,
  FAKE_SLACK_BOT_TOKEN,
  FAKE_STRIPE_LIVE_KEY,
  FAKE_STRIPE_TEST_KEY,
  FAKE_GOOGLE_API_KEY,
} from '../helpers/fakeSecrets'

describe('SECRET_RULES', () => {
  it('every rule regex compiles (fails loudly on a typo, not silently)', () => {
    for (const rule of SECRET_RULES) {
      expect(() => new RegExp(rule.regex.source, rule.regex.flags), rule.id).not.toThrow()
    }
  })

  function find(id: string): (typeof SECRET_RULES)[number] {
    const rule = SECRET_RULES.find((r) => r.id === id)
    if (!rule) throw new Error(`rule not found: ${id}`)
    return rule
  }

  function firstMatch(id: string, text: string): string | null {
    const rule = find(id)
    rule.regex.lastIndex = 0
    const m = rule.regex.exec(text)
    return m ? m[0] : null
  }

  it('aws-access-token matches a real-shaped key', () => {
    expect(firstMatch('aws-access-token', `key = ${FAKE_AWS_KEY}`)).toBe(FAKE_AWS_KEY)
  })

  it('github-pat matches ghp_ tokens', () => {
    expect(firstMatch('github-pat', FAKE_GITHUB_PAT)).toBe(FAKE_GITHUB_PAT)
  })

  it('slack-bot-token matches xoxb- tokens', () => {
    expect(firstMatch('slack-bot-token', FAKE_SLACK_BOT_TOKEN)).toBe(FAKE_SLACK_BOT_TOKEN)
  })

  it('private-key matches a PEM block', () => {
    expect(firstMatch('private-key', FAKE_PRIVATE_KEY_PEM)).not.toBeNull()
  })

  describe('stripe-live-key vs stripe-test-key', () => {
    it('stripe-live-key matches sk_live_ and rejects sk_test_', () => {
      expect(firstMatch('stripe-live-key', `"${FAKE_STRIPE_LIVE_KEY}"`)).toBe(FAKE_STRIPE_LIVE_KEY)
      expect(firstMatch('stripe-live-key', `"${FAKE_STRIPE_TEST_KEY}"`)).toBeNull()
    })

    it('stripe-test-key matches sk_test_ and does not consume the trailing quote', () => {
      const match = firstMatch('stripe-test-key', `"${FAKE_STRIPE_TEST_KEY}"`)
      expect(match).toBe(FAKE_STRIPE_TEST_KEY)
      expect(match).not.toContain('"')
    })
  })

  it('gcp-api-key matches a real-shaped AIza key without the trailing quote', () => {
    const match = firstMatch('gcp-api-key', `"${FAKE_GOOGLE_API_KEY}"`)
    expect(match).toBe(FAKE_GOOGLE_API_KEY)
    expect(match).not.toContain('"')
  })

  it('jwt matches the full three-segment token without the trailing quote', () => {
    const match = firstMatch('jwt', `"${FAKE_JWT}"`)
    expect(match).toBe(FAKE_JWT)
    expect(match).not.toContain('"')
  })

  describe('generic-uri-credential', () => {
    it('matches a real embedded credential', () => {
      expect(firstMatch('generic-uri-credential', 'mongodb://admin:S3cr3tP4ss9@cluster0.mongodb.net/db')).toBe(
        '://admin:S3cr3tP4ss9@'
      )
    })

    it('does not match an SCP-style SSH remote (no ://)', () => {
      expect(firstMatch('generic-uri-credential', 'git@github.com:anonymousz77/aegis.git')).toBeNull()
    })

    it('does not match a URI with no password', () => {
      expect(firstMatch('generic-uri-credential', 'https://user@github.com/repo.git')).toBeNull()
    })

    it('does not match a URI with an empty password', () => {
      expect(firstMatch('generic-uri-credential', 'https://user:@github.com/repo.git')).toBeNull()
    })
  })

  describe('isPlaceholderPassword', () => {
    it('flags common placeholder words', () => {
      expect(isPlaceholderPassword('password')).toBe(true)
      expect(isPlaceholderPassword('changeme')).toBe(true)
      expect(isPlaceholderPassword('<password>')).toBe(true)
    })

    it('flags env-var interpolation and template placeholders', () => {
      expect(isPlaceholderPassword('$DB_PASSWORD')).toBe(true)
      expect(isPlaceholderPassword('<secret>')).toBe(true)
    })

    it('does not flag a real-looking password', () => {
      expect(isPlaceholderPassword('S3cr3tP4ss9')).toBe(false)
    })
  })
})
