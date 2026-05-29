# @jspsych/metadata

## 0.0.4

### Patch Changes

- e80e57c: Fix always-empty columns being silently dropped from variableMeasured. Columns whose values are null or empty across all rows in a dataset now appear in variableMeasured with a minimal `"value": "unknown"` entry, satisfying the Psych-DS requirement that every CSV column header has a corresponding entry.

## 0.0.3

### Patch Changes

- 974243d: Updating frontend to be more user-friendly with major edits to UI, updating metadata to support this with more specific get methods

## 0.0.2

### Patch Changes

- d091305: Updating READMEs with new links
