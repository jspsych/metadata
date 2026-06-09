---
"@jspsych/metadata": minor
"@jspsych/metadata-cli": minor
---

Extract arrays of primitives into sidecar CSVs so their elements become real, typed variables. Previously an array of numbers or strings (`block_order: [16,100,4,1]`, `images: [...]`) was recorded only as a single `value:"array"` column with no per-element detail. Such arrays are now extracted like arrays-of-objects, but — since primitives have no field name — each element is recorded under a synthetic `<column>.value` column (distinct from the array parent, which stays `value:"array"`). The element variable gets its proper type with `minValue`/`maxValue` (numeric) or `levels` (string), joinable to its row via the existing join keys + `element_index`. This composes with the nested-array recursion (an array of arrays of numbers yields a grandchild table with a `.value` column) and completes Psych-DS round-tripping for all four cell shapes: scalar, object, array-of-objects, and array-of-primitives.

Tradeoff: every non-empty primitive-array column now produces its own sidecar CSV, so datasets with many such columns generate substantially more files (e.g. one eye-tracking export grew from 304 to 380 data files). Extraction is the default and there is no new prompt. A future opt-in `primitiveArrayMode: "extract" | "summarize"` could offer an in-place summary alternative, but is intentionally not added here to avoid complicating the CLI flow.
