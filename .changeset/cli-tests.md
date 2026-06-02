---
"@jspsych/metadata-cli": patch
---

Add Jest test infrastructure and tests for the CLI package. Tests cover `utils.ts`, `validatefunctions.ts`, and `data.ts` (27 tests). Also modernizes `saveTextToPath` from a fire-and-forget callback to an `async` function returning `Promise<void>`.
