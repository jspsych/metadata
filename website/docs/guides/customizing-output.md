---
title: Customizing the output
sidebar_label: Customizing output
description: Add authors, descriptions, and variable details to the generated dataset_description.json with a metadata options file.
---

# Customizing the output

The [web wizard](/wizard) asks for the details it can't work out from your data — authors, a dataset description, descriptions for unfamiliar columns — using on-screen forms. The CLI has no forms, so you write that same information into a JSON **options file** and hand it over.

Pass it with the [`--metadata-options` flag](../reference/cli-reference.md#flags), or choose **Use a custom metadata file** when the CLI prompts you.

## File format

A plain JSON file — call it what you like and keep it wherever you like. Each key in it corresponds to a field in `dataset_description.json`. Two keys, `author` and `variables`, get special treatment (covered below); every other key is copied into the metadata as-is.

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

The ones people use most:

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

Under `author`, each entry is one person. The label you give the entry (`"Alex Johnson"` in the example above) is their display name, and every field inside it is optional.

| Field | Description |
|-------|-------------|
| `name` | Full name. If you leave it out, the entry's label is used. |
| `givenName` | First name. |
| `familyName` | Last name. |
| `identifier` | A permanent link to the person, such as an [ORCID](https://orcid.org/). |

## Variable fields

Use `variables` to add to or correct what the tool worked out from your data. Label each entry with the column name exactly as it appears in your files.

:::note
This file updates entries the tool generated — it can't create variables that aren't in your data.
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

Notice that `description` isn't plain text — it's wrapped in `{ "user": … }`. That label records where the description came from, so what you write sits *next to* the plugin's version rather than replacing it. Always use `"user"` for your own text. To keep only your version, edit `dataset_description.json` after generating it.

The fields you can set on a variable:

| Field | Type | Description |
|-------|------|-------------|
| `description` | object | What the column means, written as `{ "user": "…" }` (see above). |
| `minValue` / `maxValue` | number | Expected range for numeric variables. |
| `levels` | array | Possible values for categorical variables. |
| `levelsOrdered` | boolean | Whether `levels` has a meaningful order (e.g. a Likert scale). |
| `na` | boolean | Whether the column has missing values. |
| `naValue` | string | What missing values look like in the data (e.g. `"NA"`, `"999"`). |
| `alternateName` | string | Another name or abbreviation for the column. |
| `identifier` | string | A link to a formal definition of the variable. |
| `privacy` | string | Notes on how sensitive the column is. |

:::tip
Run the tool once **without** an options file, open `dataset_description.json` to see what was generated, then use the options file to fill the gaps and re-run. Custom descriptions persist across re-runs — updating a project reloads the existing file first.
:::

---

**Next:** the [CLI reference](../reference/cli-reference.md) for every flag and rule, or [Troubleshooting](./troubleshooting.md) if something looks off.
