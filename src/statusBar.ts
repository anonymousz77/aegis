import * as vscode from 'vscode'

export class AegisStatusBar {
  private readonly item: vscode.StatusBarItem

  constructor(context: vscode.ExtensionContext) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
    this.item.command = 'aegis.verifyOfflineMode'
    context.subscriptions.push(this.item)
    this.setReady()
    this.item.show()
  }

  setIndexing(progress: number): void {
    this.item.text = `$(sync~spin) Aegis: Indexing ${progress}%`
    this.item.tooltip = 'Aegis is indexing your workspace…'
  }

  setReady(): void {
    this.item.text = '🔒 Aegis: Local'
    this.item.tooltip = 'Aegis: All processing is 100% on-device. Click to verify.'
  }

  setError(msg: string): void {
    this.item.text = '$(warning) Aegis: ⚠ Error'
    this.item.tooltip = msg
  }

  dispose(): void {
    this.item.dispose()
  }
}
