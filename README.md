# Aegis

**Privacy-first secret detection and semantic code search — 100% on-device.**

No source code, no snippet, no telemetry payload of code content ever leaves your machine.

## Features

- **ML-based secret & credential leak detection** — two-stage detector (high-recall rules + entropy, then ML precision classifier) that catches novel formats and slashes false positives
- **Semantic code search** — describe what you want in natural language; Aegis finds it across your workspace using on-device embeddings and a local vector index
- **100% local** — all inference, indexing, and search runs on-device; the only permitted network call is a one-time, checksum-verified model download

## Requirements

VS Code 1.85.0 or later.

## Development

```bash
npm install
npm run build      # compile via esbuild → out/extension.js
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm run test       # vitest
npm run package    # produce aegis-*.vsix
```

## License

Apache-2.0 — see [LICENSE](LICENSE).
