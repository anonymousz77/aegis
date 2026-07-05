// Idempotent local download of the M1 embedding model + tokenizer files.
//
// This is a stand-in for §9's pinned+checksummed downloader (a later phase).
// For now it trusts HF's TLS plus a hardcoded commit SHA for reproducibility —
// no separate checksum manifest yet. Not part of `npm run build`; run manually
// via `npm run download-model`, or implicitly by the Layer 3 integration test.

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = 'Xenova/all-MiniLM-L6-v2'
// Pinned commit SHA, verified against the HF API to contain the files below.
const REVISION = '751bff37182d3f1213fa05d7196b954e230abad9'
const BASE_URL = `https://huggingface.co/${REPO}/resolve/${REVISION}`

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MODEL_DIR = path.join(PROJECT_ROOT, '.aegis', 'models', 'all-MiniLM-L6-v2')

const FILES = [
  { remote: 'onnx/model_int8.onnx', local: 'onnx/model_int8.onnx' },
  { remote: 'tokenizer.json', local: 'tokenizer.json' },
  { remote: 'tokenizer_config.json', local: 'tokenizer_config.json' },
]

async function downloadFile(remotePath, localPath) {
  if (fs.existsSync(localPath)) {
    console.log(`[download-model] skip (already present): ${localPath}`);
    return
  }

  const url = `${BASE_URL}/${remotePath}`
  console.log(`[download-model] fetching ${url}`)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`[download-model] failed to fetch ${url}: ${res.status} ${res.statusText}`)
  }

  fs.mkdirSync(path.dirname(localPath), { recursive: true })
  const buffer = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(localPath, buffer)
  console.log(`[download-model] wrote ${localPath} (${buffer.byteLength} bytes)`)
}

export async function ensureModelDownloaded() {
  for (const { remote, local } of FILES) {
    await downloadFile(remote, path.join(MODEL_DIR, local))
  }
  return {
    onnxPath: path.join(MODEL_DIR, 'onnx', 'model_int8.onnx'),
    tokenizerJsonPath: path.join(MODEL_DIR, 'tokenizer.json'),
    tokenizerConfigPath: path.join(MODEL_DIR, 'tokenizer_config.json'),
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url)
if (isMain) {
  ensureModelDownloaded()
    .then((paths) => console.log('[download-model] done:', paths))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
