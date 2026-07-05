'use strict'
const esbuild = require('esbuild')

const options = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  external: ['vscode'],   // host provides this — never bundle it
  platform: 'node',
  format: 'cjs',
  target: ['node18'],     // VS Code 1.85 ships Electron 27 → Node 18.18.x
  sourcemap: true,
}

if (process.argv.includes('--watch')) {
  esbuild.context(options)
    .then(ctx => ctx.watch())
    .catch(() => process.exit(1))
} else {
  esbuild.build(options).catch(() => process.exit(1))
}
