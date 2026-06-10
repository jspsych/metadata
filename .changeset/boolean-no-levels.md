---
"@jspsych/metadata": patch
---

Boolean variables no longer record `levels`. Genuine boolean values (`typeof === "boolean"`) are typed `value:"boolean"` with no `levels`/`minValue`/`maxValue`, and string `"true"`/`"false"` values are kept as strings so they surface as `levels: ["true","false"]` (no longer coerced to boolean). A manual `value:"boolean"` override now drops any detected levels and warns when the detected values don't map cleanly to true/false (anything other than `true`/`false`/`0`/`1`). This also fixes a bug where raw booleans were pushed into the `levels` array, producing inconsistent `[false]`/empty output.
