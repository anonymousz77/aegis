import { vi } from 'vitest'
// Type-only: resolves to the real @types/vscode declarations (tsc ignores
// Vitest's runtime module alias), purely so mock objects can be cast to the
// real types the production code under test is declared against.
import type * as RealVSCode from 'vscode'

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}

export class Position {
  constructor(
    public readonly line: number,
    public readonly character: number
  ) {}
}

export class Range {
  constructor(
    public readonly start: Position,
    public readonly end: Position
  ) {}
}

export class Diagnostic {
  source?: string
  code?: string | number
  constructor(
    public range: Range,
    public message: string,
    public severity: DiagnosticSeverity = DiagnosticSeverity.Error
  ) {}
}

export class MarkdownString {
  value: string
  isTrusted = false
  constructor(value = '') {
    this.value = value
  }
  appendMarkdown(text: string): this {
    this.value += text
    return this
  }
  appendText(text: string): this {
    this.value += text
    return this
  }
}

export class Hover {
  constructor(
    public contents: MarkdownString | MarkdownString[],
    public range?: Range
  ) {}
}

export class Uri {
  private constructor(
    public readonly fsPath: string,
    public readonly scheme: string
  ) {}
  static file(fsPath: string): Uri {
    return new Uri(fsPath, 'file')
  }
  toString(): string {
    return `${this.scheme}://${this.fsPath}`
  }
}

class MockDiagnosticCollection {
  private readonly store = new Map<string, Diagnostic[]>()
  constructor(public readonly name: string) {}
  set(uri: { toString(): string }, diagnostics: readonly Diagnostic[] | undefined): void {
    if (diagnostics === undefined) this.store.delete(uri.toString())
    else this.store.set(uri.toString(), [...diagnostics])
  }
  get(uri: { toString(): string }): Diagnostic[] | undefined {
    return this.store.get(uri.toString())
  }
  delete(uri: { toString(): string }): void {
    this.store.delete(uri.toString())
  }
  clear(): void {
    this.store.clear()
  }
  dispose = vi.fn()
}

export const languages = {
  createDiagnosticCollection: vi.fn((name?: string) => new MockDiagnosticCollection(name ?? '')),
  registerHoverProvider: vi.fn((_selector: unknown, _provider: unknown) => ({ dispose: vi.fn() })),
}

/**
 * Minimal vscode.TextDocument stand-in — enough for offset<->Position
 * conversion. Cast to the real TextDocument type so callers (which typecheck
 * against the real @types/vscode signatures) don't need their own casts.
 */
export function createMockTextDocument(text: string, filePath: string): RealVSCode.TextDocument {
  const uri = Uri.file(filePath)
  const lineStarts: number[] = [0]
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') lineStarts.push(i + 1)
  }
  const doc = {
    uri,
    getText: (): string => text,
    positionAt: (offset: number): Position => {
      let line = 0
      for (let i = 1; i < lineStarts.length; i++) {
        if (lineStarts[i] > offset) break
        line = i
      }
      return new Position(line, offset - lineStarts[line])
    },
    offsetAt: (position: Position): number => lineStarts[position.line] + position.character,
  }
  return doc as unknown as RealVSCode.TextDocument
}

let mockConfigStore: Record<string, unknown> = {}
const onDidChangeListeners: Array<(e: { affectsConfiguration: (s: string) => boolean }) => void> = []

export function setMockConfig(store: Record<string, unknown>): void {
  mockConfigStore = { ...store }
}

export function resetMockConfig(): void {
  mockConfigStore = {}
  onDidChangeListeners.length = 0
}

export function fireConfigChange(section = 'aegis'): void {
  const event = {
    affectsConfiguration: (s: string): boolean =>
      s === section || s.startsWith(section + '.'),
  }
  onDidChangeListeners.forEach(l => l(event))
}

export const window = {
  createStatusBarItem: vi.fn((_alignment?: StatusBarAlignment, _priority?: number) => ({
    text: '',
    tooltip: '',
    command: undefined as string | undefined,
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
  })),
  showInformationMessage: vi.fn(),
  activeTextEditor: undefined as { document: unknown } | undefined,
  onDidChangeActiveTextEditor: vi.fn((_listener: (editor: { document: unknown } | undefined) => void) => ({
    dispose: vi.fn(),
  })),
}

export const workspace = {
  getConfiguration: vi.fn((_section?: string) => ({
    get: vi.fn(<T>(key: string, defaultValue?: T): T | undefined => {
      return (key in mockConfigStore ? mockConfigStore[key] : defaultValue) as T | undefined
    }),
    has: vi.fn(() => false),
    update: vi.fn(),
    inspect: vi.fn(),
  })),
  onDidSaveTextDocument: vi.fn((_listener: (document: unknown) => void) => ({ dispose: vi.fn() })),
  onDidChangeConfiguration: vi.fn(
    (listener: (e: { affectsConfiguration: (s: string) => boolean }) => void) => {
      onDidChangeListeners.push(listener)
      return {
        dispose: vi.fn(() => {
          const idx = onDidChangeListeners.indexOf(listener)
          if (idx !== -1) onDidChangeListeners.splice(idx, 1)
        }),
      }
    }
  ),
}

export const commands = {
  registerCommand: vi.fn((_id: string, _callback: () => void) => ({ dispose: vi.fn() })),
}
