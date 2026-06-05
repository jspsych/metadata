---
"@jspsych/metadata": minor
---

Recursively expand nested JSON objects more than one level deep. Previously `expandObjectFields` only expanded a single level, so a value like `response: {"Q0":{"score":4,"meta":{"valid":true}}}` registered `response.Q0` as an opaque `value:"object"` leaf and lost its sub-fields. Now nested plain objects are fully expanded into dotted sub-variables (`response.Q0.score`, `response.Q0.meta.valid`) with correct types and min/max/levels tracking at any depth. Arrays nested inside objects are now correctly typed as `value:"array"` instead of `"object"`, and nested arrays-of-objects are extracted into their own Psych-DS CSV files keyed by their dotted column name — mirroring how top-level array columns are handled.
