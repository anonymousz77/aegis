import { describe, expect, it } from 'vitest'
import {
  containsDowngradeKeyword,
  identifierHint,
  isCommentLine,
  isKnownExampleValue,
  isTestFilePath,
} from '../../src/secrets/contextFeatures'
import { AWS_DOC_EXAMPLE_KEY, AWS_EXAMPLE_KEY_VARIANT, FAKE_AWS_KEY, STRIPE_DOC_EXAMPLE_KEY } from '../helpers/fakeSecrets'

describe('isTestFilePath', () => {
  it('matches __tests__ directories', () => {
    expect(isTestFilePath('/repo/test/fixtures/secrets/__tests__/sample.txt')).toBe(true)
  })

  it('matches __mocks__ directories', () => {
    expect(isTestFilePath('/repo/test/__mocks__/vscode.ts')).toBe(true)
  })

  it('matches *.test.* and *.spec.* filenames', () => {
    expect(isTestFilePath('/repo/src/foo.test.ts')).toBe(true)
    expect(isTestFilePath('/repo/src/foo.spec.ts')).toBe(true)
  })

  it('does not match an ordinary source path', () => {
    expect(isTestFilePath('/repo/src/secrets/pipeline.ts')).toBe(false)
  })
})

describe('containsDowngradeKeyword', () => {
  it('matches example/fake/mock/dummy/sample/placeholder/demo/test substrings', () => {
    expect(containsDowngradeKeyword('fakeAwsKey')).toBe(true)
    expect(containsDowngradeKeyword('mockApiToken')).toBe(true)
    expect(containsDowngradeKeyword('DUMMY_SECRET')).toBe(true)
  })

  it('does not match an unrelated identifier', () => {
    expect(containsDowngradeKeyword('awsAccessKeyId')).toBe(false)
  })
})

describe('isCommentLine', () => {
  it('recognizes // and # line comments', () => {
    expect(isCommentLine('  // a comment')).toBe(true)
    expect(isCommentLine('# a shell comment')).toBe(true)
  })

  it('does not flag ordinary code', () => {
    expect(isCommentLine('const x = 1')).toBe(false)
  })
})

describe('identifierHint', () => {
  it('extracts the identifier from a const assignment', () => {
    const text = 'const fakeApiKey = "AKIA..."'
    const matchStart = text.indexOf('"') + 1
    expect(identifierHint(text, matchStart)).toBe('fakeApiKey')
  })

  it('extracts the key from a JSON-style assignment', () => {
    const text = '"secretToken": "AKIA..."'
    const matchStart = text.lastIndexOf('"AKIA') + 1
    expect(identifierHint(text, matchStart)).toBe('secretToken')
  })

  it('returns null when there is no assignment shape', () => {
    const text = 'just some plain text AKIA...'
    expect(identifierHint(text, text.indexOf('AKIA'))).toBeNull()
  })
})

describe('isKnownExampleValue', () => {
  it('matches the exact AWS example key', () => {
    expect(isKnownExampleValue(AWS_DOC_EXAMPLE_KEY, 'aws-access-token')).toBe(true)
  })

  it('matches any AKIA key containing the EXAMPLE substring', () => {
    expect(isKnownExampleValue(AWS_EXAMPLE_KEY_VARIANT, 'aws-access-token')).toBe(true)
  })

  it('matches the Stripe documentation example key', () => {
    expect(isKnownExampleValue(STRIPE_DOC_EXAMPLE_KEY, 'stripe-test-key')).toBe(true)
  })

  it('does not match an ordinary fake key', () => {
    expect(isKnownExampleValue(FAKE_AWS_KEY, 'aws-access-token')).toBe(false)
  })
})
