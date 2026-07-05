import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Worker } from 'node:worker_threads'
import { compileInferenceWorker } from '../helpers/compileWorker'
import type { WorkerResponse } from '../../src/workers/inference.worker'
// @ts-expect-error - plain JS script, no type declarations
import { ensureModelDownloaded } from '../../scripts/download-model.mjs'

/**
 * Layer 3 — the real M1 acceptance criterion: real model, real tokenizer,
 * real worker thread, real latency numbers. Downloads ~22MB on first run
 * (idempotent after) so it's gated behind AEGIS_INTEGRATION=1 and skipped in
 * CI by default.
 */
const runIntegration = process.env.AEGIS_INTEGRATION === '1'

describe.skipIf(!runIntegration)('inference worker — real model integration', () => {
  let worker: Worker

  beforeAll(async () => {
    const { onnxPath, tokenizerJsonPath, tokenizerConfigPath } = await ensureModelDownloaded()
    const workerFile = compileInferenceWorker()
    worker = new Worker(workerFile, {
      workerData: { onnxPath, tokenizerJsonPath, tokenizerConfigPath },
    })
    await waitForMessage(worker, (msg) => msg.type === 'ready')
  }, 120_000)

  afterAll(async () => {
    await worker.terminate()
  })

  it('embeds a single string into a valid unit vector', async () => {
    worker.postMessage({ type: 'embed', id: 'single', text: 'const apiKey = "sk_live_abc123"' })
    const response = await waitForMessage(worker, (msg) => 'id' in msg && msg.id === 'single')

    expect(response.type).toBe('embedResult')
    if (response.type !== 'embedResult') throw new Error('unreachable')
    expect(response.vector).toHaveLength(384)
    const norm = Math.sqrt(response.vector.reduce((sum, v) => sum + v * v, 0))
    expect(Number.isFinite(norm)).toBe(true)
    expect(norm).toBeCloseTo(1, 5)
  })

  it('logs p50 latency for one string (5 runs, 1 warm-up)', async () => {
    const text = 'where do we retry failed webhook deliveries?'
    const durations: number[] = []
    for (let i = 0; i < 6; i++) {
      worker.postMessage({ type: 'embed', id: `warm-${i}`, text })
      const response = await waitForMessage(worker, (msg) => 'id' in msg && msg.id === `warm-${i}`)
      if (response.type === 'embedResult' && i > 0) durations.push(response.durationMs)
    }
    durations.sort((a, b) => a - b)
    const p50 = durations[Math.floor(durations.length / 2)]
    // eslint-disable-next-line no-console
    console.log(`[M1 latency] single string p50 over ${durations.length} runs: ${p50.toFixed(2)}ms`)
    expect(p50).toBeGreaterThan(0)
  }, 60_000)

  it('logs latency for a batch of 32 strings', async () => {
    const texts = Array.from({ length: 32 }, (_, i) => `sample code snippet number ${i}`)
    worker.postMessage({ type: 'embedBatch', id: 'batch-32', texts })
    const response = await waitForMessage(worker, (msg) => 'id' in msg && msg.id === 'batch-32')

    expect(response.type).toBe('embedBatchResult')
    if (response.type !== 'embedBatchResult') throw new Error('unreachable')
    expect(response.vectors).toHaveLength(32)
    // eslint-disable-next-line no-console
    console.log(
      `[M1 latency] batch of 32 total: ${response.durationMs.toFixed(2)}ms ` +
        `(${(response.durationMs / 32).toFixed(2)}ms/item avg)`
    )
    expect(response.durationMs).toBeGreaterThan(0)
  }, 60_000)
})

function waitForMessage(worker: Worker, predicate: (msg: WorkerResponse) => boolean): Promise<WorkerResponse> {
  return new Promise((resolve, reject) => {
    const onMessage = (msg: WorkerResponse): void => {
      if (predicate(msg)) {
        worker.off('message', onMessage)
        worker.off('error', onError)
        resolve(msg)
      }
    }
    const onError = (err: Error): void => {
      worker.off('message', onMessage)
      worker.off('error', onError)
      reject(err)
    }
    worker.on('message', onMessage)
    worker.on('error', onError)
  })
}
