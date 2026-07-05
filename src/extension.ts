import * as vscode from 'vscode'
import { ConfigService } from './config'
import { AegisStatusBar } from './statusBar'

let statusBar: AegisStatusBar | undefined

export function activate(context: vscode.ExtensionContext): void {
  const config = new ConfigService()
  statusBar = new AegisStatusBar(context)

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
    })
  )
}

export function deactivate(): void {
  statusBar?.dispose()
}
