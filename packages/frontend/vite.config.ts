import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)

// psychds-validator's browser bundle statically imports `node:process` and
// dynamically imports a few Node-only modules inside `if (!isBrowser)` branches
// that never execute in the browser. Point them all at an empty stub so the
// bundle resolves. See src/validation/node-stub.ts for details.
const nodeStub = fileURLToPath(new URL('./src/validation/node-stub.ts', import.meta.url))

// The package's `exports` map only exposes ".", so a deep import to
// ./web/psychds-validator.js is blocked by Node/Rollup exports resolution.
// Resolve the real file by absolute path (works regardless of npm hoisting)
// and alias the specifier to it, which bypasses exports resolution.
const validatorMain = require.resolve('psychds-validator')
const PKG = 'psychds-validator'
const validatorWeb = path.join(
  validatorMain.slice(0, validatorMain.lastIndexOf(PKG) + PKG.length),
  'web',
  'psychds-validator.js',
)

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'psychds-validator/web/psychds-validator.js': validatorWeb,
      'node:process': nodeStub,
      'node:fs/promises': nodeStub,
      'node:fs': nodeStub,
      winston: nodeStub,
      chalk: nodeStub,
      'cli-table3': nodeStub,
    },
  },
})
