---
"@jspsych/metadata": patch
---

fix(metadata): treat mixed-type columns as categorical, not numeric+categorical

A column containing both numeric and non-numeric values previously produced
contradictory metadata: `value: "number"` alongside both `minValue`/`maxValue`
and `levels`. The fix decides at the cell level — once a non-numeric value
arrives in a column that had numeric min/max (or vice versa), the column is
downgraded to categorical: min/max fields are removed, boundary values are
preserved as string levels, and a `console.warn` is emitted once per column.
