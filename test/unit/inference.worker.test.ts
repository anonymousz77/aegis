import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { InferenceSession, Tensor } from 'onnxruntime-node'
import { Tokenizer } from '@huggingface/tokenizers'
import {
  assertVocabSize,
  handleEmbed,
  handleEmbedBatch,
  type EmbeddingSession,
} from '../../src/workers/inference.worker'

const FIXTURE_DIR = path.resolve(__dirname, '../fixtures/tokenizer')
const tokenizerJson = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'tokenizer.json'), 'utf-8'))
const tokenizerConfig = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'tokenizer_config.json'), 'utf-8'))

function makeTokenizer(): Tokenizer {
  // Tokenizer's constructor mutates/reads its inputs by reference in places,
  // so give every test its own deep copy of the fixture JSON.
  return new Tokenizer(JSON.parse(JSON.stringify(tokenizerJson)), tokenizerConfig)
}

/**
 * hidden_size = 1, per-token value = (t+1)*2 (always positive). Mean-pooling
 * any set of positive scalars is positive, and L2-normalizing a 1-dim vector
 * always collapses it to exactly [1] regardless of its magnitude — so this
 * lets us hand-verify the pool -> normalize pipeline without hardcoding an
 * exact token count for a given input string.
 */
function makeLinearFakeSession(): EmbeddingSession {
  return {
    async run(feeds): Promise<InferenceSession.ReturnType> {
      const inputIds = feeds['input_ids'] as Tensor
      const seqLen = Number(inputIds.dims[1])
      const data = new Float32Array(seqLen)
      for (let t = 0; t < seqLen; t++) data[t] = (t + 1) * 2
      return {
        last_hidden_state: new Tensor('float32', data, [1, seqLen, 1]),
      }
    },
  }
}

describe('assertVocabSize', () => {
  it('passes for the real tokenizer', () => {
    expect(() => assertVocabSize(makeTokenizer())).not.toThrow()
  })

  it('throws for a mismatched vocab', () => {
    const truncated = JSON.parse(JSON.stringify(tokenizerJson))
    const vocab = truncated.model.vocab as Record<string, number>
    for (const key of Object.keys(vocab).slice(100)) delete vocab[key]
    const mismatched = new Tokenizer(truncated, tokenizerConfig)

    expect(() => assertVocabSize(mismatched)).toThrow(/vocab size mismatch/i)
  })
})

describe('handleEmbed', () => {
  it('returns a unit-length vector via mean-pool + L2-normalize', async () => {
    const { vector, durationMs } = await handleEmbed(makeLinearFakeSession(), makeTokenizer(), 'test')

    expect(vector).toHaveLength(1)
    expect(vector[0]).toBeCloseTo(1, 10)
    expect(durationMs).toBeGreaterThanOrEqual(0)
  })

  it('rejects empty input', async () => {
    await expect(handleEmbed(makeLinearFakeSession(), makeTokenizer(), '')).rejects.toThrow(/non-empty/)
  })

  it('rejects oversized input', async () => {
    const huge = 'a'.repeat(100_001)
    await expect(handleEmbed(makeLinearFakeSession(), makeTokenizer(), huge)).rejects.toThrow(/exceeds max length/)
  })
})

describe('handleEmbedBatch', () => {
  it('embeds multiple strings and returns one vector per input', async () => {
    const { vectors, durationMs } = await handleEmbedBatch(makeLinearFakeSession(), makeTokenizer(), [
      'test',
      'another test',
      'a third string entirely',
    ])

    expect(vectors).toHaveLength(3)
    for (const vector of vectors) {
      expect(vector).toHaveLength(1)
      expect(vector[0]).toBeCloseTo(1, 10)
    }
    expect(durationMs).toBeGreaterThanOrEqual(0)
  })

  it('rejects an empty array', async () => {
    await expect(handleEmbedBatch(makeLinearFakeSession(), makeTokenizer(), [])).rejects.toThrow(/non-empty array/)
  })
})
