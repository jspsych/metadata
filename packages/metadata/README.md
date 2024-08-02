# Metadata Module

The metadata module contains functions for interacting metadata according to [Psych-DS standards](https://psych-ds.github.io/). To interact with the metadata, we strongly recommend you call the generate method on the experiment data then adjust fields accordingly. The generate method uses documentation for plugins and extensions created in the main JsPsych repo to create default descriptions. This works best for experiments run in v8+, but will also work for old experimental data.

You can import the metadata module by including this line at the top of your html.

```html
<script>update</script>
```

---

## metadata.generate 

```javascript
var metadata = new jsPsychMetadata();
await metadata.generate(properties);
```

### Parameters

| Parameter | Type | Description
----------|------|------------
| data      | object, string | The data file that was generated from running a JsPsych experiment. This can be passed in as string Json, string CSV or as an object. Depending on the type of data will need to change the CSV flag. |
| metadata  | object | Optional metadata that can be passed in to adjust the output of the generate method. Each key-value pair will map to a parameter field, and will either overwite existing data or create new fields. All normal fields can be adjusted as entries within the object, but for authors and variables the entries need to be nested within an "author" or "variables" key mapping. Similarily, updating the descriptions of variables needs to be a nested map. |
| format       | boolean|  Optional flag that should be marked 'csv' if data is in a string csv format. If passing in as an object can specify as 'json' or leave blank. |

### Return value

Returns nothing.

### Description

This method creates metadata using data from JsPsych experiments by loading and parsing plugin information. This method allows you to adjust the fields by specifying an object with the fields, authors and variables with the changes. This accepts both csv and json strings, and if passing in a csv will need to specify the boolean csv flag.

### Examples

#### Calling metadata after running an experiment and adjusting fields

```javascript
var metadata = new jsPsychMetadata();

const metadata_options = {
  randomField: "this is a field",
  author: {
    "John": {
      name: "John",
      givenName: "Jonathan",
    },
  },
  variables: {
    "trial_type" : {
      description: {
        "chat-plugin": "this chat plugin allows you to talk to gpt!",
      }
    },
    "trial_index": {
      name: "index",
    },
  },
}

var jsPsych = initJsPsych({
  on_finish: async function() {
    await metadata.generate(jsPsych.data.get().json(), metadata_options);
  },
});
```

---

## metadata.getMetadata

```javascript
var metadata = new jsPsychMetadata();
metadata.getMetadata();
```

### Parameters

No parameters.

### Return value

Returns the metadata as an object.

### Description

This method allows you to access the metadata for processes.

---

## metadata.localSave

```javascript
var metadata = new jsPsychMetadata();
metadata.localSave();
```

### Parameters

No parameters.

### Return value

Returns nothing. Downloads file locally.

### Description

This method allows you download the metadata in the format specified as Psych-DS, a json file named "dataset_description.json".

---

## metadata.updateMetadata

```javascript
var metadata = new jsPsychMetadata();
metadata.updateMetadata();
```
### Parameters

| Parameter | Type | Description
----------|------|------------
| metadata  | object | Optional metadata that can be passed in to adjust the output of the generate method. Each key-value pair will map to a parameter field, and will either overwite existing data or create new fields. All normal fields can be adjusted as entries within the object, but for authors and variables the entries need to be nested within an "author" or "variables" key mapping. Similarily, updating the descriptions of variables needs to be a nested map. |

### Return value

Returns nothing.

### Description

This method allows you to adjust the fields by specifying an object with the fields, authors and variables with the changes. This method can also allow you to generate the metadata from scratch.

### Examples

#### Calling metadata after running an experiment and adjusting fields

```javascript
var metadata = new jsPsychMetadata();

const metadata_options = {
  randomField: "this is a field",
  author: {
    "John": {
      name: "John",
      givenName: "Jonathan",
    },
  },
  variables: {
    "trial_type" : {
      description: {
        "chat-plugin": "this chat plugin allows you to talk to gpt!",
      }
    },
    "trial_index": {
      name: "index",
    },
  },
}

await metadata.updateMetadata(metadata_options);
```

---

## metadata.displayMetadata

```javascript
var metadata = new jsPsychMetadata();
metadata.displayMetadata(properties);
```
### Parameters

| Parameter | Type | Description
----------|------|------------
| display_element  | HTMLElement | This is the element of the screen that should always be passed in from JsPsych.getDisplayElement(). This lets you display the metadata in addition to the data that is generated after an experiment. |

### Return value

Returns nothing.

### Description

This method allows you to display the metadata by appending it to the end of the screen.

### Examples

#### Calling displayMetadata after running an experiment and adding fields

```javascript
var metadata = new jsPsychMetadata();

var jsPsych = initJsPsych({
  on_finish: async function() {      
    await metadata.generate(jsPsych.data.get().json());
    jsPsych.data.displayData();  
    metadata.displayMetadata(jsPsych.getDisplayElement());
  },
  default_iti: 250
});
```