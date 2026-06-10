---
"@jspsych/metadata": minor
---

Export Psych-DS utility functions from the core package: `isValidPsychDSDataFilename`, `toPsychDSValue`, `deriveArrayFilename`, `objectsToCSV`, `disambiguateArrayFilename`. Previously these lived only in the CLI. Moving them to core makes them available to any downstream consumer (e.g. the frontend) and ensures the CLI and any future tools share a single implementation.

The CLI now imports these functions from `@jspsych/metadata` instead of defining them locally. No behaviour change.
