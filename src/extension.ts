import * as vscode from 'vscode'
import { ConfigService } from './config'
import { AegisStatusBar } from './statusBar'
import { SecretsDiagnosticProvider } from './diagnostics/provider'
import { SecretsHoverProvider } from './diagnostics/hover'

let statusBar: AegisStatusBar | undefined
let diagnosticsProvider: SecretsDiagnosticProvider | undefined

export function activate(context: vscode.ExtensionContext): void {
  const config = new ConfigService()
  statusBar = new AegisStatusBar(context)
  diagnosticsProvider = new SecretsDiagnosticProvider(config)

  context.subscriptions.push(
    vscode.commands.registerCommand('aegis.hello', () => {
      vscode.window.showInformationMessage(
        'Aegis is running 100% locally. No code ever leaves your machine.'
      )
    }),
    vscode.commands.registerCommand('aegis.verifyOfflineMode', () => {
      vscode.window.showInformationMessage(
        'Offline verification is coming in a future release. All Aegis features run fully on-device.'
      )
    }),
    config.onDidChange(() => {
      // Additional services will hook here from M1+
    }),
    diagnosticsProvider,
    vscode.languages.registerHoverProvider('*', new SecretsHoverProvider(diagnosticsProvider)),
    vscode.workspace.onDidSaveTextDocument((document) => diagnosticsProvider?.scanDocument(document)),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) diagnosticsProvider?.scanDocument(editor.document)
    })
  )

  if (vscode.window.activeTextEditor) {
    diagnosticsProvider.scanDocument(vscode.window.activeTextEditor.document)
  }
}

export function deactivate(): void {
  statusBar?.dispose()
  diagnosticsProvider?.dispose()
}
