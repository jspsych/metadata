---
title: Customizing the output
sidebar_label: Customizing output
description: Add authors, descriptions, and variable details to the generated dataset_description.json with a metadata options file.
---

# Customizing the output

The [web wizard](/wizard) collects extra information — authors, a dataset description, variable descriptions — through its on-screen forms. The CLI has no forms, so you supply that same information as a JSON **options file**: the command-line equivalent of filling in those fields.

Pass it with the [`--metadata-options` flag](../reference/cli-reference.md#flags), or choose **Use a custom metadata file** when the CLI prompts you.

## File format

A plain JSON file (any name, anywhere). Each top-level key maps to a field in `dataset_description.json`; two keys have special handling (`author` and `variables`), and everything else is written through directly.

```json
{
  "name": "Flanker Study",
  "description": "A jsPsych flanker task measuring response inhibition.",
  "author": {
    "Alex Johnson": {
      "givenName": "Alex",
      "familyName": "Johnson",
      "identifier": "https://orcid.org/0000-0000-0000-0000"
    }
  },
  "variables": {
    "rt": {
      "description": { "user": "Response time in ms from stimulus onset to key press." }
    }
  }
}
```

You only need to include what you want to add or override — everything else is generated automatically from your data.

## Top-level fields

Any key other than `author` or `variables` is written straight through. Commonly used ones:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | The name of the dataset. |
| `description` | string | A plain-language description of the dataset. |
| `license` | string | The license the data is shared under (e.g. `"CC-BY-4.0"`). |
| `citation` | string | A citation for the dataset or associated publication. |
| `url` | string | Where the dataset can be found (e.g. an OSF link). |
| `funder` | string | Name of the funding body. |
| `keywords` | array | Keywords describing the study (e.g. `["attention", "inhibition"]`). |

These map to [Schema.org Dataset](https://schema.org/Dataset) properties; any valid Schema.org field can be included.

## Author fields

The `author` key takes an object where each entry is one author, keyed by their display name (also used as `name` if you don't set it explicitly).

| Field | Required | Description |
|-------|----------|-------------|
| `name` | inferred | Full name. Defaults to the author's key if omitted. |
| `givenName` | no | First name. |
| `familyName` | no | Last name. |
| `identifier` | no | A persistent identifier URL, such as an [ORCID](https://orcid.org/). |

## Variable fields

The `variables` key enriches or overrides variable metadata auto-generated from your data. Each entry is keyed by the exact column name.

:::note
Variables listed here must already exist in your data — the options file can update entries the tool generated, not create new ones.
:::

```json
{
  "variables": {
    "rt": {
      "description": { "user": "Response time in milliseconds." },
      "minValue": 0,
      "maxValue": 5000
    },
    "correct": {
      "description": { "user": "Whether the response was correct." },
      "levels": ["true", "false"],
      "levelsOrdered": false
    }
  }
}
```

Descriptions use a source-keyed object: use `"user"` for text you write yourself. Your entry appears *alongside* any plugin-fetched description rather than replacing it, so the final field shows both. To replace one outright, edit `dataset_description.json` after generation.

Accepted variable fields:

| Field | Type | Description |
|-------|------|-------------|
| `description` | object | Source-keyed description (see above). |
| `minValue` / `maxValue` | number | Expected range for numeric variables. |
| `levels` | array | Possible values for categorical variables. |
| `levelsOrdered` | boolean | Whether `levels` has a meaningful order (e.g. a Likert scale). |
| `na` | boolean | Whether missing values are present. |
| `naValue` | string | The string used for missing values (e.g. `"NA"`, `"999"`). |
| `alternateName` | string | An alternative name or abbreviation. |
| `identifier` | string | A URL pointing to a formal definition of the variable. |
| `privacy` | string | Notes on the sensitivity of the variable. |

:::tip
Run the tool once **without** an options file, open `dataset_description.json` to see what was generated, then use the options file to fill the gaps and re-run. Custom descriptions persist across re-runs — updating a project reloads the existing file first.
:::
