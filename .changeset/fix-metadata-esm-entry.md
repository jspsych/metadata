---
"@jspsych/metadata": patch
---

fix(metadata): make the Node ESM entry (`dist/index.js`) loadable

The build runs esbuild (which emits the bundled `dist/index.js`) followed by
`tsc`. With `declaration: true` and `outDir: ./dist` but no `emitDeclarationOnly`,
`tsc` re-emitted an unbundled `dist/index.js` over esbuild's bundle, leaving
extensionless relative imports (e.g. `./utils`) that Node's ESM loader rejects.
Added `emitDeclarationOnly: true` so `tsc` emits only the `.d.ts` declarations and
esbuild's working bundle survives; type-checking and `dist/index.d.ts` are unchanged.
