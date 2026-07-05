import * as vscode from 'vscode'
import type { Finding } from '../secrets/pipeline'
import type { SecretsDiagnosticProvider } from './provider'

export class SecretsHoverProvider implements vscode.HoverProvider {
  constructor(private readonly provider: SecretsDiagnosticProvider) {}

  provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
    const offset = document.offsetAt(position)
    const finding = this.provider
      .findingsFor(document.uri)
      .find((f) => offset >= f.startOffset && offset < f.endOffset)

    if (!finding) return undefined

    const range = new vscode.Range(document.positionAt(finding.startOffset), document.positionAt(finding.endOffset))
    return new vscode.Hover(renderFindingMarkdown(finding), range)
  }
}

export function renderFindingMarkdown(finding: Finding): vscode.MarkdownString {
  const md = new vscode.MarkdownString()
  md.appendMarkdown(`**Possible ${finding.vendor}**\n\n`)
  md.appendMarkdown(`Masked value: \`${finding.maskedPreview}\`\n\n`)

  if (finding.entropyBits !== undefined) {
    md.appendMarkdown(`Entropy: ${finding.entropyBits.toFixed(2)} bits/char (${finding.entropyBucket})\n\n`)
  }
  if (finding.signals.length > 0) {
    md.appendMarkdown(`Signals: ${finding.signals.join(', ')}\n\n`)
  }
  md.appendMarkdown('_ML confidence: not yet available — arrives in M3_')

  return md
}
