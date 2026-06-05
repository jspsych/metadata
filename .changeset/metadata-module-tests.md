---
"@jspsych/metadata": patch
---

Expand metadata-module test suite to cover previously untested public API: `containsMetadataField`, `deleteMetadataField`, `containsVariable`, `getUserMetadataFields`, `loadMetadata` (roundtrip for fields, authors, and variables), and `updateMetadata` (top-level fields, author key, variables key, and missing-variable warning).
