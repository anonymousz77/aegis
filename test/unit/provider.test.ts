import { describe, expect, it, beforeEach, vi } from 'vitest'
import * as vscode from 'vscode'
import { createMockTextDocument, resetMockConfig, setMockConfig } from '../__mocks__/vscode'
import { ConfigService } from '../../src/config'
import { SecretsDiagnosticProvider } from '../../src/diagnostics/provider'
import { FAKE_AWS_KEY, FAKE_STRIPE_TEST_KEY } from '../helpers/fakeSecrets'

function latestCollection(): {
  get: (uri: { toString(): string }) => vscode.Diagnostic[] | undefined
  dispose: () => void
} {
  const results = vi.mocked(vscode.languages.createDiagnosticCollection).mock.results
  return results[results.length - 1]!.value
}

describe('SecretsDiagnosticProvider', () => {
  beforeEach(() => {
    resetMockConfig()
    vi.clearAllMocks()
  })

  it('scans a document and creates a HIGH diagnostic for a fake AWS key', () => {
    const provider = new SecretsDiagnosticProvider(new ConfigService())
    const doc = createMockTextDocument(`const awsAccessKeyId = "${FAKE_AWS_KEY}"`, '/repo/src/config.ts')

    provider.scanDocument(doc)

    const diagnostics = latestCollection().get(doc.uri)
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics![0].severity).toBe(vscode.DiagnosticSeverity.Error)
    expect(diagnostics![0].message).toContain('AWS Access Key')
    expect(provider.findingsFor(doc.uri)).toHaveLength(1)
  })

  it('filters out findings below the configured severity threshold', () => {
    setMockConfig({ secretsSeverityThreshold: 'high' })
    const provider = new SecretsDiagnosticProvider(new ConfigService())
    // stripe-test-key is a MEDIUM-tier rule match — below a 'high' threshold.
    const doc = createMockTextDocument(
      `const key = "${FAKE_STRIPE_TEST_KEY}"`,
      '/repo/src/config.ts'
    )

    provider.scanDocument(doc)

    expect(latestCollection().get(doc.uri)).toHaveLength(0)
    expect(provider.findingsFor(doc.uri)).toHaveLength(0)
  })

  it('skips documents over the 1MB size cap', () => {
    const provider = new SecretsDiagnosticProvider(new ConfigService())
    const hugeText = `const awsAccessKeyId = "${FAKE_AWS_KEY}"` + ' '.repeat(1_000_001)
    const doc = createMockTextDocument(hugeText, '/repo/src/huge.ts')

    provider.scanDocument(doc)

    expect(provider.findingsFor(doc.uri)).toHaveLength(0)
  })

  it('skips non-file-scheme documents', () => {
    const provider = new SecretsDiagnosticProvider(new ConfigService())
    const doc = {
      uri: { scheme: 'git', toString: (): string => 'git://repo/config.ts', fsPath: '/repo/config.ts' },
      getText: (): string => `const awsAccessKeyId = "${FAKE_AWS_KEY}"`,
      positionAt: vi.fn(),
      offsetAt: vi.fn(),
    }

    provider.scanDocument(doc as unknown as vscode.TextDocument)

    expect(provider.findingsFor(doc.uri as unknown as vscode.Uri)).toHaveLength(0)
  })

  it('dispose() clears the collection and stored findings', () => {
    const provider = new SecretsDiagnosticProvider(new ConfigService())
    const doc = createMockTextDocument(`const awsAccessKeyId = "${FAKE_AWS_KEY}"`, '/repo/src/config.ts')
    provider.scanDocument(doc)

    provider.dispose()

    expect(latestCollection().dispose).toHaveBeenCalled()
    expect(provider.findingsFor(doc.uri)).toHaveLength(0)
  })
})
