---
"@jspsych/metadata": patch
---

Fix whitespace-only string values being misdetected as numeric (#70). A cell containing only whitespace (e.g. a single space) passed the `isNaN(Number(value))` check because `Number(" ")` is `0`, but `parseFloat(" ")` is `NaN` — leaking through as `NaN` `minValue`/`maxValue` (serialized to `null`) on otherwise-categorical string columns. The numeric check now requires non-empty trimmed content and uses `Number` for both the test and the conversion so they cannot disagree.
