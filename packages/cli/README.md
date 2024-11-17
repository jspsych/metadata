# Metadata-CLI Module

The metadata-cli module contains commands for interacting with the metadata-module to create and modify existing metadata according to [Psych-DS standards](https://psych-ds.github.io/). You can interact with the cli tool by running it with a graphical interface or by passing in the paths to you're data and metadata option .json files.

---

## CLI with prompting (recommended)

To run the CLI with prompting you can call ```npx @jspsych/metadata-cli```. This is the recommended way of running the package.

This will then prompt you through the various CLI options, this includes generating from scratch or using an existing file. There are descriptions of how the files and directories should be structured below. 

## CLI without prompting and optional flags

If you are findng the prompting steps to be more of a hinderance rather, then you can skip steps by directly passing in the arguments when calling npx. 

An example is:

```
npx @jspsych/metadata-cli --verbose --psych-ds-dir=/path/to/existing/metadata/dir --data-dir=/path/to/data/dir --metadata-options=/path/to/metadata-options.json
```

The ```--verbose``` flag when called will make the output more descriptive and will explain all the steps that are happening in more detail. This is only recommended when there is something going wrong and you need to get more information.

The ```--psych-ds-dir --data-dir --metadata-options``` flags all correspond to the different prompting steps. Using the example above, you are able to skip all prompting steps by entering the correct information. If any of these inputs are not valid the CLI will prompt you until you enter a valid input.

```--psych-ds-dir``` corresponds to an existing Psych-DS valid directory. This is to be used if want to update existing metadata.

```--data-dir``` corresponds to the data folder that you want to use to update or create the metadata.

```--metadata-options``` corresponds to the options.json that you want to use to overwrite the defaults and update the existing metadata.

## Running the CLI locally

To run the CLI locally, you will need to clone this repo and navigate to the CLI directory. To do this, you must have node installed and it is not recommended unless you have programming experience. This is best if you want to customize the CLI according to your specific use case or want to avoid using npm/npx. 

1. Clone the repository.
2. Navigate to the CLI directory.
3. Install the necessary packages with ```npm install```.
4. Build the cli file with ```npm run build```.
5. Run the cli with ```npx .```.

## Common errors

### Path to data requirements  

The path that is given to the data must be a directory. If you are running the CLI without prompting, the ```dataset_description.json``` should be in the root directory. 

All the files in the data folder must be valid JsPsych-generated .csv and .json files. All the files that are in the directory will be scraped. If the data files are mixed in with other non-data files, there may be unintended errors. The CLI will scrape one level deep into the directories, but will not recurse infinitely. 

### Metadata options requirements 

The metadata-options file must be in .json format and needs to include the same 

### Naming Requirements

The ```dataset_description.json``` must be named as is according to Psych-DS specification, and the rest of the files must be organized as Psych-DS requirements.


## Psych-DS Validator

When running the cli tool, all metadata will undergo an automatic validation when loading existing metadata and upon the process of creating new metadata files. This process will print out any resulting errors that cause this validation to fail and the number of warnings encounter. The warnings will not be print out by default, but can instead be seen by running the CLI again with the --verbose flag. 