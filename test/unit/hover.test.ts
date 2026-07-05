import { describe, expect, it, beforeEach, vi } from 'vitest'
import { createMockTextDocument, resetMockConfig } from '../__mocks__/vscode'
import { ConfigService } from '../../src/config'
import { SecretsDiagnosticProvider } from '../../src/diagnostics/provider'
import { SecretsHoverProvider, renderFindingMarkdown } from '../../src/diagnostics/hover'
import type { Finding } from '../../src/secrets/pipeline'
import { FAKE_AWS_KEY } from '../helpers/fakeSecrets'

describe('SecretsHoverProvider', () => {
  beforeEach(() => {
    resetMockConfig()
    vi.clearAllMocks()
  })

  it('returns a Hover with rule/vendor, masked preview, signals, and the M3 stub when hovering a flagged range', () => {
    const diagnosticsProvider = new SecretsDiagnosticProvider(new ConfigService())
    const hoverProvider = new SecretsHoverProvider(diagnosticsProvider)
    const text = `const fakeAwsKey = "${FAKE_AWS_KEY}"`
    const doc = createMockTextDocument(text, '/repo/src/config.ts')
    diagnosticsProvider.scanDocument(doc)

    const insidePosition = doc.positionAt(text.indexOf(FAKE_AWS_KEY) + 2)
    const hover = hoverProvider.provideHover(doc, insidePosition)

    expect(hover).toBeDefined()
    // Real @types/vscode types Hover.contents as an array; our mock (used at
    // runtime here) stores the single MarkdownString we actually passed in —
    // cast through unknown to assert against the mock's real runtime shape.
    const md = hover!.contents as unknown as { value: string }
    expect(md.value).toContain('AWS Access Key')
    expect(md.value).toContain('AK••')
    expect(md.value).toContain('identifier_hint')
    expect(md.value).toContain('ML confidence: not yet available')
  })

  it('returns undefined when hovering a position with no finding', () => {
    const diagnosticsProvider = new SecretsDiagnosticProvider(new ConfigService())
    const hoverProvider = new SecretsHoverProvider(diagnosticsProvider)
    const text = 'function add(a, b) { return a + b }'
    const doc = createMockTextDocument(text, '/repo/src/config.ts')
    diagnosticsProvider.scanDocument(doc)

    const hover = hoverProvider.provideHover(doc, doc.positionAt(5))

    expect(hover).toBeUndefined()
  })
})

describe('renderFindingMarkdown (redaction)', () => {
  it('never includes the raw secret value in the rendered markdown', () => {
    const rawValue = FAKE_AWS_KEY
    const finding: Finding = {
      ruleId: 'aws-access-token',
      vendor: 'AWS Access Key ID',
      severity: 'high',
      startOffset: 0,
      endOffset: rawValue.length,
      maskedPreview: 'AK••••••••••••••••OP',
      signals: [],
    }

    const md = renderFindingMarkdown(finding)

    expect(md.value).not.toContain(rawValue)
  })
})
