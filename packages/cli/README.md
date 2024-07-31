# Metadata-CLI Module

The metadata-cli module contains commands for interacting with the metadata-module to create and modify existing metadata according to [Psych-DS standards](https://psych-ds.github.io/). You can interact with the cli tool by running it with a graphical interface or by passing in the paths to you're data and metadata option .json files.

---

## CLI with prompting (recommended)

To run the CLI with prompting you can call ```npx jspsych-metadata-cli```. You can also run it through the repository by following the steps 1-3 below and then calling ```npm run build``` followed by ```npx .```. 

This will then prompt you through the various CLI options, this includes generating from scratch or using an existing file. There are descriptions of how the files and directories should be structured below. 

## CLI without prompting 

Depending on the build step, when running it locally you may need to rename the package.json attribute ```"type": "commonjs"``` to ```"type": "module"```. To run the CLI without prompting, you would need to clone this repo and navigate to the CLI directory. To do this, you must have node installed and it is not recommended unless you have programming experience. 

1. Clone the repository.
2. Navigate to the CLI directory.
3. Install the necessary packages with ```npm install```.
4. Build the cli file with ```npm run build```.
5. Run the cli with ```node /dist/cli.js /path/to/data/dir /path/to/metadata_options.json```.

Within the package.json, there are examples of running this using existing data files. You can run those commands with ```npm run data``` or ```npm run options```.

If the metadata file has already been created, ensure that ```dataset_description.json``` is located in the root directory. This CLI will successfully load the old data prior to updating it with new data and will then overwrite the original data.

This will likely 

## Common errors

### Path to data requirements  

The path that is given to the data must be a directory. If you are running the CLI without prompting, the ```dataset_description.json``` should be in the root directory. 

All the files in the data folder must be valid JsPsych-generated .csv and .json files. All the files that are in the directory will be scraped. If the data files are mixed in with other non-data files, there may be unintended errors. The CLI will scrape one level deep into the directories, but will not recurse infinitely. 

### Metadata options requirements 

The metadata-options file must be in .json format and needs to include the same 

### Naming Requirements

The ```dataset_description.json``` must be named as is according to Psych-DS specification, and the rest of the files must be organized as Psych-DS requirements.