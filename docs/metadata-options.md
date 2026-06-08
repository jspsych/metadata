# Metadata Options File

A metadata options file lets you set or override fields in the generated `dataset_description.json` before it is saved. You can use it to add author information, a dataset description, or custom variable descriptions that the tool couldn't determine automatically.

Pass the file path to the CLI with the `--metadata-options` flag, or choose **Use a custom metadata file** when prompted interactively.

---

## File format

The options file is a plain JSON file. It can have any name and be stored anywhere — only the content matters.

At the top level, each key maps to a field in `dataset_description.json`. Two keys have special handling (`author` and `variables`); everything else is written through directly.

**Minimal example:**

```json
{
  "name": "Flanker Study",
  "description": "A jsPsych flanker task measuring response inhibition."
}
```

**Complete example:**

```json
{
  "name": "Flanker Study",
  "description": "A jsPsych flanker task measuring response inhibition in undergraduate participants.",
  "author": {
    "Alex Johnson": {
      "givenName": "Alex",
      "familyName": "Johnson",
      "identifier": "https://orcid.org/0000-0000-0000-0000"
    }
  },
  "variables": {
    "rt": {
      "description": { "user": "Response time in milliseconds from stimulus onset to key press." }
    },
    "correct": {
      "description": { "user": "Whether the participant's response matched the correct answer (true/false)." }
    }
  }
}
```

---

## Top-level fields

Any key not named `author` or `variables` is written directly to `dataset_description.json`. Commonly used fields:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | The name of the dataset. |
| `description` | string | A plain-language description of the dataset. |
| `license` | string | The license under which the data is shared (e.g. `"CC-BY-4.0"`). |
| `citation` | string | A citation for the dataset or associated publication. |
| `url` | string | A URL where the dataset can be found (e.g. OSF link). |
| `funder` | string | Name of the funding body. |
| `keywords` | array | List of keywords describing the study (e.g. `["attention", "inhibition"]`). |

These correspond to [Schema.org Dataset](https://schema.org/Dataset) properties. Any valid Schema.org field can be included.

---

## Author fields

The `author` key takes an object where each entry represents one author. The key you use for each author is their display name, which is also used as the `name` field if you don't specify one explicitly.

```json
{
  "author": {
    "Alex Johnson": {
      "givenName": "Alex",
      "familyName": "Johnson",
      "identifier": "https://orcid.org/0000-0000-0000-0000"
    },
    "Sam Lee": {
      "givenName": "Sam",
      "familyName": "Lee"
    }
  }
}
```

Accepted author fields:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | inferred | Full name. Defaults to the author's key if omitted. |
| `givenName` | no | First name. |
| `familyName` | no | Last name. |
| `identifier` | no | A persistent identifier URL, such as an [ORCID](https://orcid.org/) (`https://orcid.org/...`). |

---

## Variable fields

The `variables` key lets you enrich or override variable metadata that was auto-generated from your data files. Each entry is keyed by the exact column name as it appears in your CSV files.

> **Note:** Variables listed here must already exist in your data. The tool generates a variable entry for every column it finds — the options file can only update those entries, not create new ones.

```json
{
  "variables": {
    "rt": {
      "description": { "user": "Response time in milliseconds from stimulus onset to key press." },
      "minValue": 0,
      "maxValue": 5000
    },
    "correct": {
      "description": { "user": "Whether the response was correct." },
      "levels": ["true", "false"],
      "levelsOrdered": false
    },
    "stimulus": {
      "description": { "user": "The flanker arrow string shown on screen." }
    }
  }
}
```

### The `description` field

Variable descriptions use an object where each key identifies the source of the description and each value is the description text:

```json
"description": { "user": "My description here." }
```

Use `"user"` as the key for descriptions you write yourself. The tool uses plugin names (e.g. `"jsPsych-html-keyboard-response"`) as keys for descriptions it fetches automatically. Your `"user"` entry appears alongside auto-generated entries rather than replacing them, so the final description in `dataset_description.json` will show both.

To replace a description entirely, open `dataset_description.json` after generation and edit the `description` field for that variable directly.

### Accepted variable fields

| Field | Type | Description |
|-------|------|-------------|
| `description` | object | Source-keyed description (see above). |
| `minValue` | number | Minimum expected value for numeric variables. |
| `maxValue` | number | Maximum expected value for numeric variables. |
| `levels` | array | List of all possible values for categorical variables. |
| `levelsOrdered` | boolean | Whether `levels` has a meaningful order (e.g. Likert scale). |
| `na` | boolean | Whether missing values are present in this variable. |
| `naValue` | string | The string used to represent missing values (e.g. `"NA"`, `"999"`). |
| `alternateName` | string | An alternative name or abbreviation for the variable. |
| `identifier` | string | A URL pointing to a formal definition of this variable. |
| `privacy` | string | Notes on the sensitivity of this variable. |

---

## Tips

- **You don't need to include every field.** The options file only needs to contain what you want to add or override — the rest is generated automatically from your data.
- **Run the tool first without an options file**, then open `dataset_description.json` to see what was generated. Use the options file to fill in gaps (missing descriptions, author names, etc.) and re-run.
- **Variable descriptions you write persist across re-runs.** When you update a project with `--psych-ds-dir`, the existing `dataset_description.json` is loaded first, so your custom descriptions are carried forward.
