---
"@jspsych/metadata": patch
---

`variableMeasured.description` is now always serialized as a single schema.org Text value. When a column accumulated genuinely different descriptions from multiple plugins, `getList()` previously emitted `description` as an object (`{ pluginType: text }`), which made the Psych-DS validator raise an `OBJECT_TYPE_MISSING` warning. The distinct descriptions are now joined into one string with `" | "`. `getList()` is also idempotent now (a second call no longer mangles an already-collapsed string description), and empty descriptions collapse to `"unknown"`.
