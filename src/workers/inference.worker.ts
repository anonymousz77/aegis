import * as fs from 'node:fs'
import { isMainThread, parentPort, workerData } from 'node:worker_threads'
import { InferenceSession, Tensor } from 'onnxruntime-node'
import { Tokenizer } from '@huggingface/tokenizers'
import { loadSession } from '../models/loader'

/** hidden_size from Xenova/all-MiniLM-L6-v2 config.json at the pinned revision. */
export const EMBEDDING_DIM = 384
/** vocab_size from the same config.json — the tokenizer must match this exactly. */
export const EXPECTED_VOCAB_SIZE = 30522
/** Reject absurdly large inputs before they ever reach the tokenizer. */
const MAX_INPUT_CHARS = 100_000

/** The subset of onnxruntime-node's InferenceSession that inference actually needs. */
export interface EmbeddingSession {
  run: InferenceSession['run']
}

export type WorkerRequest =
  | { type: 'embed'; id: string; text: string }
  | { type: 'embedBatch'; id: string; texts: string[] }

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'embedResult'; id: string; vector: number[]; durationMs: number }
  | { type: 'embedBatchResult'; id: string; vectors: number[][]; durationMs: number }
  | { type: 'error'; id: string; message: string }

interface WorkerStartupData {
  onnxPath?: string
  tokenizerJsonPath: string
  tokenizerConfigPath: string
  fakeSession?: boolean
}

/** Throws loudly if the loaded tokenizer's vocab doesn't match the embedding model (§15). */
export function assertVocabSize(tokenizer: Tokenizer, expected: number = EXPECTED_VOCAB_SIZE): void {
  const actual = tokenizer.get_vocab().size
  if (actual !== expected) {
    throw new Error(
      `Tokenizer vocab size mismatch: expected ${expected}, got ${actual}. ` +
        'The tokenizer does not match the embedding model — refusing to run.'
    )
  }
}

function meanPool(hidden: Float32Array, dims: readonly number[], attentionMask: readonly number[]): Float32Array {
  const seqLen = dims[1]
  const hiddenSize = dims[2]
  const pooled = new Float32Array(hiddenSize)
  let count = 0
  for (let t = 0; t < seqLen; t++) {
    if (attentionMask[t] === 0) continue
    count++
    const base = t * hiddenSize
    for (let h = 0; h < hiddenSize; h++) {
      pooled[h] += hidden[base + h]
    }
  }
  const denom = count || 1
  for (let h = 0; h < hiddenSize; h++) pooled[h] /= denom
  return pooled
}

function l2Normalize(vec: Float32Array): Float32Array {
  let normSq = 0
  for (const v of vec) normSq += v * v
  const norm = Math.sqrt(normSq) || 1
  const out = new Float32Array(vec.length)
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm
  return out
}

function assertValidText(text: unknown): asserts text is string {
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('embed: text must be a non-empty string')
  }
  if (text.length > MAX_INPUT_CHARS) {
    throw new Error(`embed: text exceeds max length of ${MAX_INPUT_CHARS} characters`)
  }
}

/**
 * Tokenizes one string, runs it through the model, mean-pools over the
 * attention mask, and L2-normalizes the result to a unit vector.
 */
export async function handleEmbed(
  session: EmbeddingSession,
  tokenizer: Tokenizer,
  text: string
): Promise<{ vector: number[]; durationMs: number }> {
  const start = performance.now()
  assertValidText(text)

  const encoding = tokenizer.encode(text)
  const seqLen = encoding.ids.length
  const tokenTypeIds = new Array<number>(seqLen).fill(0)

  const feeds: InferenceSession.FeedsType = {
    input_ids: new Tensor('int64', encoding.ids, [1, seqLen]),
    attention_mask: new Tensor('int64', encoding.attention_mask, [1, seqLen]),
    token_type_ids: new Tensor('int64', tokenTypeIds, [1, seqLen]),
  }

  const outputs = await session.run(feeds)
  const outputName = Object.keys(outputs)[0]
  const output = outputs[outputName] as Tensor

  const pooled =
    output.dims.length === 3
      ? meanPool(output.data as Float32Array, output.dims, encoding.attention_mask)
      : new Float32Array(output.data as Float32Array)
  const normalized = l2Normalize(pooled)

  return { vector: Array.from(normalized), durationMs: performance.now() - start }
}

/**
 * Embeds a batch of strings. Sequential per-string for M1 — a padded, single-
 * pass batch tensor is a later-phase optimization (§8 batching), not needed
 * to prove the pipeline works.
 */
export async function handleEmbedBatch(
  session: EmbeddingSession,
  tokenizer: Tokenizer,
  texts: string[]
): Promise<{ vectors: number[][]; durationMs: number }> {
  const start = performance.now()
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error('embedBatch: texts must be a non-empty array')
  }

  const vectors: number[][] = []
  for (const text of texts) {
    const { vector } = await handleEmbed(session, tokenizer, text)
    vectors.push(vector)
  }

  return { vectors, durationMs: performance.now() - start }
}

/** Test-only stand-in for a real ONNX session — never used outside workerData.fakeSession. */
function createFakeSession(): EmbeddingSession {
  return {
    async run(feeds): Promise<InferenceSession.ReturnType> {
      const inputIds = feeds['input_ids'] as Tensor
      const seqLen = Number(inputIds.dims[1])
      const data = new Float32Array(seqLen * EMBEDDING_DIM).fill(0.1)
      return {
        last_hidden_state: new Tensor('float32', data, [1, seqLen, EMBEDDING_DIM]),
      }
    },
  }
}

async function main(): Promise<void> {
  if (!parentPort) return
  const port = parentPort
  const data = workerData as WorkerStartupData

  const tokenizerJson = JSON.parse(fs.readFileSync(data.tokenizerJsonPath, 'utf-8'))
  const tokenizerConfig = JSON.parse(fs.readFileSync(data.tokenizerConfigPath, 'utf-8'))
  const tokenizer = new Tokenizer(tokenizerJson, tokenizerConfig)
  assertVocabSize(tokenizer)

  const session: EmbeddingSession = data.fakeSession ? createFakeSession() : await loadSession(data.onnxPath!)

  port.postMessage({ type: 'ready' } satisfies WorkerResponse)

  port.on('message', async (msg: WorkerRequest) => {
    try {
      if (msg.type === 'embed') {
        const { vector, durationMs } = await handleEmbed(session, tokenizer, msg.text)
        port.postMessage({ type: 'embedResult', id: msg.id, vector, durationMs } satisfies WorkerResponse)
      } else if (msg.type === 'embedBatch') {
        const { vectors, durationMs } = await handleEmbedBatch(session, tokenizer, msg.texts)
        port.postMessage({ type: 'embedBatchResult', id: msg.id, vectors, durationMs } satisfies WorkerResponse)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      port.postMessage({ type: 'error', id: msg.id, message } satisfies WorkerResponse)
    }
  })
}

if (!isMainThread) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err)
    if (parentPort) {
      parentPort.postMessage({ type: 'error', id: 'startup', message } satisfies WorkerResponse)
    }
    throw err
  })
}
