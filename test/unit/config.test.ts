import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setMockConfig, resetMockConfig, fireConfigChange } from '../__mocks__/vscode'
import { ConfigService } from '../../src/config'

describe('ConfigService', () => {
  beforeEach(() => {
    resetMockConfig()
    vi.clearAllMocks()
  })

  describe('get()', () => {
    it('offlineOnly defaults to true', () => {
      expect(new ConfigService().get().offlineOnly).toBe(true)
    })

    it('reads overridden offlineOnly', () => {
      setMockConfig({ offlineOnly: false })
      expect(new ConfigService().get().offlineOnly).toBe(false)
    })

    it('secretsSeverityThreshold defaults to medium', () => {
      expect(new ConfigService().get().secretsSeverityThreshold).toBe('medium')
    })

    it('modelClassifier defaults to gbm', () => {
      expect(new ConfigService().get().modelClassifier).toBe('gbm')
    })

    it('returns a complete AegisConfig with array fields', () => {
      const cfg = new ConfigService().get()
      expect(cfg).toMatchObject({
        offlineOnly: true,
        secretsSeverityThreshold: 'medium',
        modelEmbeddings: 'minilm-l6-v2',
        modelClassifier: 'gbm',
      })
      expect(Array.isArray(cfg.indexerInclude)).toBe(true)
      expect(Array.isArray(cfg.indexerExclude)).toBe(true)
    })
  })

  describe('onDidChange()', () => {
    it('fires listener when aegis config changes', () => {
      const service = new ConfigService()
      const listener = vi.fn()
      service.onDidChange(listener)
      fireConfigChange('aegis')
      expect(listener).toHaveBeenCalledOnce()
    })

    it('does not fire for unrelated config sections', () => {
      const service = new ConfigService()
      const listener = vi.fn()
      service.onDidChange(listener)
      fireConfigChange('editor')
      expect(listener).not.toHaveBeenCalled()
    })

    it('passes updated config to listener', () => {
      const service = new ConfigService()
      const listener = vi.fn()
      service.onDidChange(listener)
      setMockConfig({ offlineOnly: false })
      fireConfigChange('aegis')
      expect((listener.mock.calls[0][0] as { offlineOnly: boolean }).offlineOnly).toBe(false)
    })

    it('returns a disposable', () => {
      const disposable = new ConfigService().onDidChange(vi.fn())
      expect(typeof disposable.dispose).toBe('function')
    })
  })
})
