import { vi } from 'vitest'

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
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
