---
"@jspsych/metadata": minor
"@jspsych/metadata-cli": minor
---

Recursively unnest nested data inside extracted array elements. Previously an array-of-objects column was extracted one level deep, so an element field that was itself an object (`pointData.point`) or an array (`pointData.gazeSamples`) was kept as a single opaque JSON column. Now element fields recurse: a nested plain object is expanded into deeper dotted columns in the same sidecar row (`pointData.point.x`, `pointData.point.y`), and a nested array-of-objects is extracted into its own grandchild CSV (`..._measure-...GazeSamples_data.csv`). Grandchild tables remain joinable to their specific parent element via a qualified `<column>.element_index` key carried alongside the existing join keys (e.g. `trial_index` + `validation_data.pointData.element_index` + the grandchild's own `element_index`), and every such key/column is registered in `variableMeasured`. This completes Psych-DS round-tripping for arbitrarily nested object/array data — arrays nested inside arrays inside objects now fully expand instead of bottoming out as JSON.
