import * as esbuild from 'esbuild'
import * as fs from 'node:fs'
import * as path from 'node:path'

// `onnxruntime-node` is external (native .node binary, can't be bundled), so
// Node resolves it via normal node_modules lookup at require-time. That only
// works if the compiled file lives inside the project tree — the OS temp dir
// is typically on a different drive/mount with no node_modules above it.
const TMP_ROOT = path.resolve(__dirname, '../../.vitest-tmp')

/**
 * Compiles src/workers/inference.worker.ts to a standalone .cjs file in a
 * project-local temp directory, independent of `npm run build`. Keeps
 * worker-spawning tests hermetic and immune to CI step ordering (CI currently
 * runs `test` before `build`).
 */
export function compileInferenceWorker(): string {
  fs.mkdirSync(TMP_ROOT, { recursive: true })
  const outDir = fs.mkdtempSync(path.join(TMP_ROOT, 'worker-'))
  const outfile = path.join(outDir, 'inference.worker.cjs')

  esbuild.buildSync({
    entryPoints: [path.resolve(__dirname, '../../src/workers/inference.worker.ts')],
    bundle: true,
    outfile,
    platform: 'node',
    format: 'cjs',
    target: ['node18'],
    external: ['onnxruntime-node'],
  })

  return outfile
}
