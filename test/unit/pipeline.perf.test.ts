import { describe, expect, it } from 'vitest'
import { scan } from '../../src/secrets/pipeline'

function buildSyntheticFile(lines: number): string {
  const rows: string[] = []
  for (let i = 0; i < lines; i++) {
    if (i % 47 === 0) {
      rows.push(`const awsAccessKeyId${i} = "AKIAABCDEFGHIJKLM${String(i % 10).padStart(3, '0')}"`)
    } else if (i % 11 === 0) {
      rows.push(`// this is a comment line explaining the function below (${i})`)
    } else {
      rows.push(`function helper${i}(a, b) { return a + b + ${i} } // line ${i}`)
    }
  }
  return rows.join('\n')
}

describe('pipeline performance (§7.4 budget: p95 < 250ms on a 500-line file)', () => {
  it('scans a synthetic 500-line file within budget', () => {
    const text = buildSyntheticFile(500)
    const opts = { filePath: '/repo/src/perf-sample.ts' }

    // warm-up (JIT, regex compilation caches)
    scan(text, opts)

    const RUNS = 50
    const durations: number[] = []
    for (let i = 0; i < RUNS; i++) {
      const start = performance.now()
      scan(text, opts)
      durations.push(performance.now() - start)
    }
    durations.sort((a, b) => a - b)

    const p50 = durations[Math.floor(RUNS * 0.5)]
    const p95 = durations[Math.floor(RUNS * 0.95)]

    // eslint-disable-next-line no-console
    console.log(`[M2 perf] 500-line scan — p50: ${p50.toFixed(2)}ms, p95: ${p95.toFixed(2)}ms`)

    expect(p95).toBeLessThan(250)
  })
})
