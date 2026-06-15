---
"@jspsych/metadata": patch
---

fix(metadata): preserve string descriptions and primitive column types across generate() calls

Two related bugs fixed in metadata generation:

1. **String descriptions wiped on re-generate** — `VariablesMap.updateDescription` previously
   replaced any non-object description with `{}` before merging, discarding user-written
   descriptions loaded from an existing `dataset_description.json`. Non-object descriptions
   are now promoted to `{ default: string }` so they survive subsequent `generate()` calls.

2. **Mixed-type column typed as "array" instead of "string"** — When a column's rows contain
   a mix of primitive values and arrays/objects (e.g. a `response` column with keyboard-trial
   strings and survey-trial objects), later rows previously overwrote the column type to
   `"array"`. The array-type override now only fires when the existing type is not already a
   concrete primitive (`"string"`, `"number"`, or `"boolean"`).
