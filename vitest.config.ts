import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, 'test/__mocks__/vscode.ts'),
    },
  },
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/config.ts', 'src/statusBar.ts'],
      thresholds: {
        lines: 90,
        functions: 90,
      },
    },
  },
})
