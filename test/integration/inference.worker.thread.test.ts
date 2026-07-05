import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Worker } from 'node:worker_threads'
import * as path from 'node:path'
import { compileInferenceWorker } from '../helpers/compileWorker'
import type { WorkerResponse } from '../../src/workers/inference.worker'

const FIXTURE_DIR = path.resolve(__dirname, '../fixtures/tokenizer')

/**
 * Real worker_threads.Worker, real tokenizer, workerData.fakeSession so no
 * ONNX file (real or synthetic) is needed — proves the actual postMessage
 * contract and ready handshake across a real thread boundary, CI-safe.
 */
describe('inference worker — thread contract (fake session)', () => {
  let worker: Worker
  let workerFile: string

  beforeAll(async () => {
    workerFile = compileInferenceWorker()
    worker = new Worker(workerFile, {
      workerData: {
        tokenizerJsonPath: path.join(FIXTURE_DIR, 'tokenizer.json'),
        tokenizerConfigPath: path.join(FIXTURE_DIR, 'tokenizer_config.json'),
        fakeSession: true,
      },
    })
    await waitForMessage(worker, (msg) => msg.type === 'ready')
  })

  afterAll(async () => {
    await worker.terminate()
  })

  it('responds to embed with a 384-dim vector', async () => {
    worker.postMessage({ type: 'embed', id: 'req-1', text: 'const apiKey = "sk_live_abc123"' })
    const response = await waitForMessage(worker, (msg) => 'id' in msg && msg.id === 'req-1')

    expect(response.type).toBe('embedResult')
    if (response.type !== 'embedResult') throw new Error('unreachable')
    expect(response.vector).toHaveLength(384)
    expect(response.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('responds to embedBatch with one vector per input', async () => {
    worker.postMessage({ type: 'embedBatch', id: 'req-2', texts: ['one', 'two', 'three'] })
    const response = await waitForMessage(worker, (msg) => 'id' in msg && msg.id === 'req-2')

    expect(response.type).toBe('embedBatchResult')
    if (response.type !== 'embedBatchResult') throw new Error('unreachable')
    expect(response.vectors).toHaveLength(3)
    for (const vector of response.vectors) expect(vector).toHaveLength(384)
  })
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
