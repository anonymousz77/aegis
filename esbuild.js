'use strict'
const esbuild = require('esbuild')

const sharedOptions = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: ['node18'],     // VS Code 1.85 ships Electron 27 → Node 18.18.x
  sourcemap: true,
  // Native addons ship their own .node binaries — esbuild can't bundle those,
  // so they must stay external and be resolved from node_modules at runtime.
  external: ['vscode', 'onnxruntime-node'],
}

const extensionOptions = {
  ...sharedOptions,
  entryPoints: ['src/extension.ts'],
  outfile: 'out/extension.js',
}

const workerOptions = {
  ...sharedOptions,
  entryPoints: ['src/workers/inference.worker.ts'],
  outfile: 'out/workers/inference.worker.js',
}

if (process.argv.includes('--watch')) {
  Promise.all([
    esbuild.context(extensionOptions).then(ctx => ctx.watch()),
    esbuild.context(workerOptions).then(ctx => ctx.watch()),
  ]).catch(() => process.exit(1))
} else {
  Promise.all([
    esbuild.build(extensionOptions),
    esbuild.build(workerOptions),
  ]).catch(() => process.exit(1))
}
