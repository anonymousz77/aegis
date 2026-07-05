import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as vscode from 'vscode'
import { resetMockConfig } from '../__mocks__/vscode'
import { AegisStatusBar } from '../../src/statusBar'

function makeMockContext(): vscode.ExtensionContext {
  return { subscriptions: [] } as unknown as vscode.ExtensionContext
}

describe('AegisStatusBar', () => {
  let bar: AegisStatusBar
  let mockItem: ReturnType<typeof vscode.window.createStatusBarItem>

  beforeEach(() => {
    resetMockConfig()
    vi.clearAllMocks()
    bar = new AegisStatusBar(makeMockContext())
    mockItem = vi.mocked(vscode.window.createStatusBarItem).mock.results[0].value
  })

  it('constructor calls setReady — text contains lock emoji and Local', () => {
    expect(mockItem.text).toContain('🔒')
    expect(mockItem.text).toContain('Local')
  })

  it('constructor calls show()', () => {
    expect(mockItem.show).toHaveBeenCalledOnce()
  })

  it('setReady sets text with lock and Local', () => {
    bar.setReady()
    expect(mockItem.text).toContain('🔒')
    expect(mockItem.text).toContain('Local')
  })

  it('setIndexing 50 shows 50% in text', () => {
    bar.setIndexing(50)
    expect(mockItem.text).toContain('50%')
  })

  it('setIndexing 0 shows 0% in text', () => {
    bar.setIndexing(0)
    expect(mockItem.text).toContain('0%')
  })

  it('setError shows warning character in text', () => {
    bar.setError('connection failed')
    expect(mockItem.text).toContain('⚠')
  })

  it('setError stores message in tooltip', () => {
    bar.setError('connection failed')
    expect(mockItem.tooltip).toContain('connection failed')
  })

  it('dispose calls item.dispose()', () => {
    bar.dispose()
    expect(mockItem.dispose).toHaveBeenCalledOnce()
  })
})
