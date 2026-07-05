import * as vscode from 'vscode'
import { scan, SEVERITY_RANK, type Finding } from '../secrets/pipeline'
import type { Severity } from '../secrets/rules'
import type { ConfigService } from '../config'

/** §8's stated hard cap — never scan a file bigger than this. */
const MAX_FILE_SIZE_BYTES = 1_000_000

function toDiagnosticSeverity(severity: Severity): vscode.DiagnosticSeverity {
  if (severity === 'high') return vscode.DiagnosticSeverity.Error
  if (severity === 'medium') return vscode.DiagnosticSeverity.Warning
  return vscode.DiagnosticSeverity.Information
}

export class SecretsDiagnosticProvider implements vscode.Disposable {
  private readonly collection: vscode.DiagnosticCollection
  private readonly findingsByUri = new Map<string, Finding[]>()

  constructor(private readonly config: ConfigService) {
    this.collection = vscode.languages.createDiagnosticCollection('aegis-secrets')
  }

  scanDocument(document: vscode.TextDocument): void {
    if (document.uri.scheme !== 'file') return

    const text = document.getText()
    if (text.length > MAX_FILE_SIZE_BYTES) {
      this.collection.set(document.uri, undefined)
      this.findingsByUri.delete(document.uri.toString())
      return
    }

    const thresholdRank = SEVERITY_RANK[this.config.get().secretsSeverityThreshold]
    const surfaced = scan(text, { filePath: document.uri.fsPath }).filter(
      (finding) => SEVERITY_RANK[finding.severity] >= thresholdRank
    )

    const diagnostics = surfaced.map((finding) => {
      const range = new vscode.Range(document.positionAt(finding.startOffset), document.positionAt(finding.endOffset))
      const diagnostic = new vscode.Diagnostic(
        range,
        `Possible ${finding.vendor}`,
        toDiagnosticSeverity(finding.severity)
      )
      diagnostic.source = 'Aegis'
      return diagnostic
    })

    this.collection.set(document.uri, diagnostics)
    this.findingsByUri.set(document.uri.toString(), surfaced)
  }

  findingsFor(uri: vscode.Uri): Finding[] {
    return this.findingsByUri.get(uri.toString()) ?? []
  }

  dispose(): void {
    this.collection.dispose()
    this.findingsByUri.clear()
  }
}
