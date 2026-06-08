---
"@jspsych/metadata": patch
---

Switch csv-parse import to the browser/esm build so the metadata package can run in a browser environment without Node-specific internals. Jest is redirected to the CJS build via a moduleNameMapper override since the ESM build requires transformation that Jest skips for node_modules.
