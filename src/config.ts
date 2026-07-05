import * as vscode from 'vscode'

export interface AegisConfig {
  offlineOnly: boolean
  secretsSeverityThreshold: 'high' | 'medium' | 'low'
  indexerInclude: string[]
  indexerExclude: string[]
  modelEmbeddings: string
  modelClassifier: 'gbm' | 'transformer'
}

const DEFAULTS: AegisConfig = {
  offlineOnly: true,
  secretsSeverityThreshold: 'medium',
  indexerInclude: ['**/*'],
  indexerExclude: [
    'node_modules/**', 'dist/**', 'build/**', '.venv/**',
    'target/**', '.next/**', '.turbo/**', '.aegis/**',
  ],
  modelEmbeddings: 'minilm-l6-v2',
  modelClassifier: 'gbm',
}

export class ConfigService {
  get(): AegisConfig {
    const cfg = vscode.workspace.getConfiguration('aegis')
    return {
      offlineOnly: cfg.get<boolean>('offlineOnly') ?? DEFAULTS.offlineOnly,
      secretsSeverityThreshold:
        cfg.get<AegisConfig['secretsSeverityThreshold']>('secretsSeverityThreshold') ??
        DEFAULTS.secretsSeverityThreshold,
      indexerInclude: cfg.get<string[]>('indexer.include') ?? DEFAULTS.indexerInclude,
      indexerExclude: cfg.get<string[]>('indexer.exclude') ?? DEFAULTS.indexerExclude,
      modelEmbeddings: cfg.get<string>('model.embeddings') ?? DEFAULTS.modelEmbeddings,
      modelClassifier:
        cfg.get<AegisConfig['modelClassifier']>('model.classifier') ?? DEFAULTS.modelClassifier,
    }
  }

  onDidChange(listener: (cfg: AegisConfig) => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('aegis')) {
        listener(this.get())
      }
    })
  }
}
