// Stub for Node-only modules pulled in by psychds-validator's web bundle.
//
// The browser bundle (psychds-validator/web/psychds-validator.js) statically
// imports `node:process` and dynamically imports winston / chalk / cli-table3 /
// node:fs inside `if (!isBrowser)` branches that never run in the browser.
// Rollup/esbuild still has to resolve every specifier at build time, so we alias
// them all to this empty module (see vite.config.ts). The only property the
// bundle reads is `process.versions` — left undefined here so its `isNode`
// check evaluates to false and the browser code path is taken.
export default {};
