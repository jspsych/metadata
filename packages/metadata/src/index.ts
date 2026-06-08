import { AuthorFields, AuthorsMap } from "./AuthorsMap";
import { PluginCache } from "./PluginCache";
import { saveTextToFile, parseCSV, tryParseJSON, analyzeJoinKeys, JoinKeyAnalysis, SYSTEM_COLUMNS } from "./utils";
import { VariableFields, VariablesMap } from "./VariablesMap";

/**
 * Class that handles the storage, update and retrieval of metadata according to Psych-DS
 * standards.
 *
 * @export
 * @class JsPsychMetadata
 * @typedef {JsPsychMetadata}
 */
export default class JsPsychMetadata {
  /**
   * Field that contains all metadata fields that aren't represented as a list.
   *
   * @private
   * @type {{}}
   */
  private metadata: {};
  /**
   * Custom class that stores and handles the storage, update and retrieval of author metadata.
   *
   * @private
   * @type {AuthorsMap}
   */
  private authors: AuthorsMap;
  /**
   * Custom class that stores and handles the storage, update and retrieval of variable metadata.
   *
   * @private
   * @type {VariablesMap}
   */
  private variables: VariablesMap;

  /**
   * Custom class that handles the fetching and retrieval of the metadata information from the 
   * default descriptions defined in the javadoc of the plugins and extensions. Caches the data
   * to save time and fetching. 
   *
   * @private
   * @type {PluginCache}
   */
  private pluginCache: PluginCache;

  /**
   * Initializes a set that contains the variable fields that are to be ignored, so can help with later 
   * logic when generating data.
   *
   * @private
   * @type {*}
   */
  private ignored_variables = new Set(SYSTEM_COLUMNS);
  
  /**
   * Verbose mode that is used in by the tools that call this to print fetching messages and 
   * reading messages.
   *
   * @private
   * @type {boolean}
   */
  private verbose: boolean = false;

  private extractedArrays: Map<string, Array<Record<string, any>>> = new Map();
  private arrayJoinKeys: string[] = ['trial_index'];
  private mixedColumns = new Set<string>();

  /**
   * Creates an instance of JsPsychMetadata while passing in JsPsych object to have access to context
   *  allowing it to access the screen printing information.
   *
   * @constructor
   * @param {JsPsych} JsPsych
   */
  constructor(verbose?: boolean) {
    this.metadata = {};
    // generates default metadata
    this.setMetadataField("name", "title");
    this.setMetadataField("schemaVersion", "Psych-DS 0.4.0");
    this.setMetadataField("@context", "https://schema.org");
    this.setMetadataField("@type", "Dataset");
    this.setMetadataField("description", "Dataset generated using JsPsych");
    this.authors = new AuthorsMap();
    this.variables = new VariablesMap();
    this.pluginCache = new PluginCache();
    this.verbose = verbose;
  }

  /**
   * Method that sets simple metadata fields. This method can also be used to update/overwrite existing fields.
   *
   * @param {string} key - Metadata field name
   * @param {*} value - Data associated with the field
   */
  setMetadataField(key: string, value: any): void {
    this.metadata[key] = value;
  }

  /**
   * Simple get that accesses the data associated with a field.
   *
   * @param {string} key - Field name
   * @returns {*} - Data associated with the field
   */
  getMetadataField(key: string): any {
    return this.metadata[key];
  }

  /**
   * Checks if the metadata field exists in the metadata.
   *
   * @param {string} key - Key of metadata being checked.
   * @returns {*} - Boolean
   */
  containsMetadataField(key: string) : any {
    return key in this.metadata;
  }

  /**
   * Deletes a metadata from the metadata if it exists. 
   *
   * @param {string} key - Name of field to be deleted
   */
  deleteMetadataField(key: string): void{
    if (key in this.metadata) {
      delete this.metadata[key];
    } else {
      console.error(`Metadata "${key}" does not exist.`);
    }
  }

  /**
   * Returns the final Metadata in a single javascript object. Bundles together the author and variables
   * together in a list rather than object compliant with Psych-DS standards. Seems that javascript get
   * are implictly called.
   *
   * @returns {{}} - Final Metadata object
   */
  getMetadata(): {} {
    const res = this.metadata;
    res["author"] = this.authors.getList();
    res["variableMeasured"] = this.variables.getList();

    return res;
  }

  getUserMetadataFields (): Record<string, any> {
    const res = {};

    const ignored_fields = new Set(["schemaVersion", "@type", "@context", "author", "variableMeasured"]); // getMetdata() impliclty called

    for (const key in this.metadata){
      if (!(ignored_fields.has(key))){
        res[key] = this.metadata[key];
      }
    }

    return res;
  }

  /**
   * Returns the variable fields while excluding the authors and variables.`
   *
   * @returns {{}} - Final Metadata object
   */
    getMetadataFields(): {} {
      const res = this.metadata;
      delete res["author"];
      delete res["variableMeasured"];

      return res;
    }

  /**
   * Generates the default descriptions for extension_type and extension_version in metadata. Should be called after
   * default metadata is generated, and only should be called once.
   **/
  generateDefaultExtensionVariables(): void {
    this.variables.generateDefaultExtensionVariables();
  }

  /**
   * Method that creates an author. This method can also be used to overwrite existing authors
   * with the same name in order to update fields.
   *
   * @param {AuthorFields | string} author - All the required or possible fields associated with listing an author according to Psych-DS standards. Option as a string to define an author according only to name.
   */
  setAuthor(fields: AuthorFields): void {
    this.authors.setAuthor(fields); // Assuming `authors` is an instance of the AuthorsMap class
  } 

  /**
   * Method that fetches an author object allowing user to update (in existing workflow should not be necessary).
   *
   * @param {string} name - Name of author to be used as key.
   * @returns {(AuthorFields | string | {})} - Object with author information. Empty object if not found.
   */
  getAuthor(name: string): AuthorFields | string | {} {
    return this.authors.getAuthor(name);
  }

  /**
   * Returns a list of the authors defined in the metadata.
   *
   * @returns {(string | AuthorFields)[]} - Authors
   */
  getAuthorList(): (string | AuthorFields)[] {
    return this.authors.getList();
  }

  /**
   * Deletes an author from the authorsField.
   *
   * @param {string} name - Name of author to be deleted.
   */
  deleteAuthor(name: string) {
    this.authors.deleteAuthor(name);
  }

  /**
   * Method that creates a variable. This method can also be used to overwrite variables with the same name
   * as a way to update fields.
   *
   * @param {{
   *     @type?: string;
   *     name: string; // required
   *     description?: string | {};
   *     value?: string; // string, boolean, or number
   *     identifier?: string; // identifier that distinguish across dataset (URL), confusing should check description
   *     minValue?: number;
   *     maxValue?: number;
   *     levels?: string[] | []; // technically property values in the other one but not sure how to format it
   *     levelsOrdered?: boolean;
   *     na?: boolean;
   *     naValue?: string;
   *     alternateName?: string;
   *     privacy?: string;
   *   }} fields - Fields associated with the current Psych-DS standard.
   */
  setVariable(variable: VariableFields): void {
    this.variables.setVariable(variable);
  }

  /**
   * Allows you to access a variable's information by using the name of the variable. Can
   * be used to update fields within a variable, but suggest using updateVariable() to prevent errors.
   *
   * @param {string} name - Name of variable to be accessed
   * @returns {{}} - Returns object of fields
   */
  getVariable(name: string): {} {
    return this.variables.getVariable(name);
  }


  /**
   * Returns a list of the variables defined in the metadata.
   *
   * @returns {{}[]} - Authors
   */
  getVariableList(): ({})[] {
    return this.variables.getList();
  }

  /**
   * Allows you to check if the name of the variable exists in variablesMap.
   *
   * @param {string} name - Name of variable
   * @returns {boolean} - Does variable exist in variables
   */
  containsVariable(name: string): boolean {
    return this.variables.containsVariable(name);
  }

  /**
   * Allows you to update a variable or add a value in the case of updating values. In other situations will
   * replace the existing value with the new value.
   *
   * @param {string} var_name - Name of variable to be updated.
   * @param {string} field_name - Name of field to be updated.
   * @param {(string | boolean | number | {})} added_value - Value to be used in the update.
   */
  updateVariable(
    var_name: string,
    field_name: string,
    added_value: string | boolean | number | {}
  ): void {
    this.variables.updateVariable(var_name, field_name, added_value);
  }

  /**
   * Allows you to delete a variable by key/name.
   *
   * @param {string} var_name - Name of variable to be deleted.
   */
  deleteVariable(var_name: string): void {
    this.variables.deleteVariable(var_name);
  }

  /**
   * Gets a list of all the variable names.
   *
   * @returns {string[]} - List of variable string names.
   */
  getVariableNames(): string[] {
    return this.variables.getVariableNames();
  }

  /**
   * Returns accumulated array-column data keyed by column name.
   * Each entry is a list of rows with join key columns, element_index, and the element's own fields.
   * Used by the CLI to write Psych-DS compliant separate CSV files.
   */
  getExtractedArrays(): Map<string, Array<Record<string, any>>> {
    return this.extractedArrays;
  }

  /**
   * Returns the join key columns used in the most recent generate() call.
   * The CLI uses this to order columns correctly in extracted array CSVs.
   */
  getArrayJoinKeys(): string[] {
    return [...this.arrayJoinKeys];
  }

  private warnJoinKeyUniqueness(analysis: JoinKeyAnalysis): void {
    const keyStr = this.arrayJoinKeys.join(', ');
    const exampleStr = analysis.duplicateValues
      .slice(0, 3)
      .map(v => Object.entries(v).map(([k, val]) => `${k}=${val}`).join(', '))
      .join('; ');

    let msg = `[jspsych-metadata] Join key (${keyStr}) is not unique in this dataset\n` +
      `  (${analysis.duplicateCount} duplicate rows; e.g. ${exampleStr})\n`;

    if (analysis.suggestedAdditionalKeys !== null && analysis.suggestedAdditionalKeys.length === 0) {
      const sufficient = analysis.candidates.filter(c => c.makesUnique).map(c => c.column);
      const example = JSON.stringify([sufficient[0], ...this.arrayJoinKeys]);
      msg += `  Sufficient fix: add one of these columns to arrayJoinKeys:\n` +
        `    ${sufficient.join(', ')}\n` +
        `  Pass { arrayJoinKeys: ${example} } as the options argument to generate().`;
    } else if (analysis.suggestedAdditionalKeys !== null && analysis.suggestedAdditionalKeys.length > 0) {
      const combined = JSON.stringify([...analysis.suggestedAdditionalKeys, ...this.arrayJoinKeys]);
      msg += `  No single column makes rows unique. Suggested combination:\n` +
        `    ${analysis.suggestedAdditionalKeys.join(' + ')}\n` +
        `  Pass { arrayJoinKeys: ${combined} } as the options argument to generate().`;
    } else {
      msg += `  No combination of available columns was found to make rows unique.\n` +
        `  Your data may contain genuinely duplicate rows.\n` +
        `  Extracted array CSVs will have non-unique join keys.`;
    }

    console.warn(msg);
  }

  /**
   * Method that allows you to display metadata at the end of an experiment.
   *
   * @param {string} [elementId="jspsych-metadata-display"] - Id for how to style the metadata. Defaults to default styling.
   */
  displayMetadata(display_element) {
    const elementId = "jspsych-metadata-display";
    const metadata_string = JSON.stringify(this.getMetadata(), null, 2);
    display_element.innerHTML += `<p id="jspsych-metadata-header">Metadata</p><pre id="${elementId}" class="jspsych-preformat"></pre>`;
    document.getElementById(elementId).textContent += metadata_string;
  }

  /**
   * Method that begins a download for the dataset_description.json at the end of experiment.
   * Allows you to download the metadat.
   */
  localSave() {
    let data_string = JSON.stringify(this.getMetadata());
    saveTextToFile(data_string, "dataset_description.json");
  }

  /**
   * This method loads the metadata into the metadata object. This takes in the"dataset_description.json" string content 
   * and first parses it as an object. This then loads in all the fields, authors and variables into the metadata object by calling all the 
   * relevant methods that overwrites the default data.
   *
   * @param {string} stringMetadata - String version of the metadata to be loaded from "dataset_description.json".
   */
  loadMetadata(stringMetadata: string): void {
    const meta = JSON.parse(stringMetadata);
    // include a method to clear authors and variables measured, might not need because only defaults

    for (const field_key in meta){
      if (field_key === "variableMeasured"){
        for (const variable of meta[field_key]){
          this.setVariable(variable);
        }
      } 
      else if (field_key === "author"){
        for (const author of meta[field_key]){
          this.setAuthor(author);
        }
      }
      else {
        this.setMetadataField(field_key, meta[field_key]);
      }
    }
  }

  /**
   * Generates observations based on the input data and processes optional metadata. This is the
   * outer wrapper function that should called and handles the logic of reading individual observations.
   *
   * This method accepts data, which can be an array of observation objects, a JSON string,
   * or a CSV string. If the data is in CSV format, set the `csv` parameter to `true` to
   * parse it into a JSON object. Each observation is processed asynchronously using the
   * `generateObservation` method. Optionally, metadata options can be provided in the form of an
   * object, and each key-value pair in the metadata object will be processed by the
   * `processMetadata` method.
   *
   * @async
   * @param {Array|String} data - The data to generate observations from. Can be an array of objects, a JSON string, or a CSV string.
   * @param {Object} [metadata={}] - Optional metadata to be processed. Each key-value pair in this object will be processed individually.
   * @param {boolean} [csv=false] - Flag indicating if the data is in a string CSV. If true, the data will be parsed as CSV.
   */
  async generate(data, metadata = {}, ext = 'json', options: { arrayJoinKeys?: string[]; suppressJoinKeyWarning?: boolean } = {}) {
    this.extractedArrays = new Map();
    this.arrayJoinKeys = options.arrayJoinKeys ?? ['trial_index'];

    var parsed_data;

    if (ext === 'csv') {
      parsed_data = await parseCSV(data);
    }

    if (ext === 'json') {
      parsed_data = JSON.parse(data);
    }

    if (!Array.isArray(parsed_data)) {
      throw new Error("Parsed data is not in correct format: Expected an array of observations");
    }

    // Callers that already surface join-key uniqueness to the user (e.g. the CLI's
    // interactive pre-analysis prompt) can suppress this warning to avoid repeating it
    // once per file.
    const analysis = analyzeJoinKeys(parsed_data as Array<Record<string, any>>, this.arrayJoinKeys);
    if (!analysis.isUnique && !options.suppressJoinKeyWarning) this.warnJoinKeyUniqueness(analysis);

    for (const observation of parsed_data) {
      await this.generateObservation(observation);
    }

    await this.updateMetadata(metadata);
  }

  /**
   * This function iterates through the entire row of data stepping through one column at a time.
   * It is designed to only be accessed through calling generate on an entire data file. 
   * Searching for plugin, plugin version, extension, extension it then calls the 
   * helper methods that process the individual row of data. There is limited error chcking and 
   * type conversion from csv due to the way that csv data is represented as strings.
   * This method also handles extensions, declaring them if necessary and iterate through each.
   * This method also skips generating descriptions the variables that should the same for 
   * all variables and instead updates their fields. 
   *
   * @private
   * @async
   * @param {*} observation Dictionary that represent one row of data
   * @returns {*}
   */
  private async generateObservation(observation) {
    // variables can be thought of mapping of one column in a row
    const version = observation["plugin_version"] ? observation["plugin_version"] : null; // changed
    const pluginType = observation["trial_type"];

    const extensionType = observation["extension_type"]; // fix for non-list (single item extension)
    const extensionVersion = observation["extension_version"];

    if (extensionType) this.generateDefaultExtensionVariables(); // After first call, generation is stopped

    for (const variable in observation) {
      var value = observation[variable];
      var type: string = typeof value;

      // Ensure every column header appears in variableMeasured even if all its values are null/empty.
      // Columns that never get a real value keep value:"unknown" and no levels, which satisfies the
      // Psych-DS requirement that every CSV column header has a corresponding variableMeasured entry.
      if (!this.containsVariable(variable) && !this.ignored_variables.has(variable)) {
        this.setVariable({
          "@type": "PropertyValue",
          name: variable,
          description: { default: "unknown" },
          value: "unknown",
        });
      }

      if (value === null || value === undefined || value === '' || value === "null"){
        continue; // Error checking
      }

      // handling type conversion from csv by converting back into number, should think about booleans as well
      if (type === "string") {
        // Number("") and Number(" ") are both 0, so a whitespace-only string would otherwise be
        // misdetected as numeric. Require non-empty trimmed content, and use Number (not parseFloat)
        // for the conversion so the numeric test and the stored value never disagree — parseFloat(" ")
        // is NaN, which previously leaked through as NaN min/max (serialized as null) for string columns.
        const asNumber = Number(value);
        // Number.isFinite (not !isNaN) also rejects "Infinity"/"-Infinity", which would otherwise
        // serialize to null min/max. The trim guard is still needed because Number(" ") is 0 (finite).
        if (value.trim() !== "" && Number.isFinite(asNumber)) {
          type = "number";
          value = asNumber;
        } else if (value.toLowerCase() === "true" || value.toLowerCase() === "false") {
          type = "boolean";
          value = (value.toLowerCase() === "true");
        } else if (value.startsWith("{") || value.startsWith("[")) {
          const parsed = tryParseJSON(value);
          if (parsed !== null) {
            value = parsed;
            type = Array.isArray(parsed) ? "array" : "object";
          }
        }
      }

      if (this.ignored_variables.has(variable)) {
        this.updateFields(variable, value, type);
      } else {
        if (type === "object" && value !== null && !Array.isArray(value)) {
          await this.expandObjectFields(variable, value, pluginType, version);
        } else if (type === "array" || (type === "object" && Array.isArray(value))) {
          // Register parent via generateMetadata to get the plugin description, then
          // override the stored type to "array" (generateMetadata would infer "object"
          // because typeof [] === "object" in JS).
          await this.generateMetadata(variable, value, pluginType, version);
          this.updateVariable(variable, "value", "array");

          // Accumulate array-of-objects rows for separate CSV output.
          // Only object elements are expanded; null / primitive elements are skipped.
          const objectElements = (value as any[]).filter(
            (el) => el !== null && typeof el === "object" && !Array.isArray(el)
          );
          if (objectElements.length > 0) {
            const joinValues = this.arrayJoinKeys.reduce((acc, k) => { acc[k] = observation[k]; return acc; }, {} as Record<string, any>);
            const existing = this.extractedArrays.get(variable) ?? [];
            (value as any[]).forEach((element, elementIndex) => {
              if (element !== null && typeof element === "object" && !Array.isArray(element)) {
                existing.push({ ...joinValues, element_index: elementIndex, ...element });
              }
            });
            this.extractedArrays.set(variable, existing);
          }
        } else {
          await this.generateMetadata(variable, value, pluginType, version);
        }

        // Extension descriptions apply to all non-ignored variables regardless of type.
        if (extensionType) {
          await Promise.all(
            extensionType.map(async (ext, index) => {
              if (ext && extensionVersion[index])
                await this.generateMetadata(variable, value, ext, extensionVersion[index], true);
            })
          );
        }
      }
    }
  }


  /**
   * Iterates through one single datapoint which can be thought of as one row-column pair. 
   * This method keeps in mind the versionType or pluginType and uses this to generate the 
   * metadata. 
   *
   * @private
   * @async
   * @param {*} variable - The column name
   * @param {*} value - The value at the row-column mapping that is being used to update fields
   * @param {*} pluginType - The type of the plugin that is used for the fetching (can also be extension if extension?=true)
   * @param {*} version - The version of the plugin that is not necessary but is used post v8 to ensure accurate fetching
   * @param {?*} [extension] - This boolean determines whether is a extension to change fetching
   * @returns {*}
   */
  private async generateMetadata(variable, value, pluginType, version, extension?) {
    if (!pluginType) { 
      return;
    }
    // probably should work in a call to the plugin here
    const pluginInfo = await this.getPluginInfo(pluginType, variable, version, extension);
    const description = pluginInfo["description"];
    const new_description = description
      ? { [pluginType]: description }
      : { [pluginType]: "unknown" };
    var type = typeof value;

    if (!this.containsVariable(variable)) {
      const new_var = {
        "@type": "PropertyValue",
        name: variable,
        description: { default: "unknown" },
        value: type,
      };
      this.setVariable(new_var);
    } else {
      // Column was pre-registered with value:"unknown" in generateObservation; upgrade to the real type
      // now that we have a concrete value.
      const existing = this.getVariable(variable) as VariableFields;
      if (existing.value === "unknown") this.updateVariable(variable, "value", type);
    }

    // hit the update variable decription fields
    this.updateVariable(variable, "description", new_description);
    this.updateFields(variable, value, type);
  }

  /**
   * This calls an update to the individual fields of the metadata, updating levels and 
   * minValue and maxValue depeneding on the variable type.
   *
   * @private
   * @param {*} variable - The column of the data and name of variable
   * @param {*} value - The datapoint 
   * @param {*} type - The type of the datapoint
   */
  private updateFields(variable, value, type) {
    // getVariable returns this.variables[name] || {}, so always an object — "x" in {} is safe.
    // The returned value is a live reference to the stored object; mutations (delete below) take
    // effect immediately. If getVariable is ever changed to return a defensive copy, the delete
    // calls must be replaced with updateVariable calls.
    const existing = this.getVariable(variable) as VariableFields;

    if (type === "number") {
      if (Array.isArray(existing.levels)) {
        // Non-numeric values seen before — column is mixed; treat as categorical.
        // mixedColumns is instance-scoped (not per-generate-call) because generate() accumulates
        // state; the warning fires at most once per column per instance lifetime.
        if (!this.mixedColumns.has(variable)) {
          this.mixedColumns.add(variable);
          console.warn(`Variable "${variable}" has mixed numeric and non-numeric values; treating as categorical.`);
        }
        this.updateVariable(variable, "levels", String(value));
        return;
      }
      this.updateVariable(variable, "minValue", value);
      this.updateVariable(variable, "maxValue", value);
      return;
    }

    if (type !== "object") {
      if ("minValue" in existing || "maxValue" in existing) {
        // Numeric values seen before — column is mixed; downgrade to categorical.
        if (!this.mixedColumns.has(variable)) {
          this.mixedColumns.add(variable);
          console.warn(`Variable "${variable}" has mixed numeric and non-numeric values; treating as categorical.`);
        }
        // Preserve boundary values as string levels before discarding the numeric fields,
        // so numeric values processed before the mix was detected are not silently lost.
        // Only the min and max are recoverable — intermediate values between them are not.
        if ("minValue" in existing) this.updateVariable(variable, "levels", String(existing.minValue));
        if ("maxValue" in existing && existing.maxValue !== existing.minValue) {
          this.updateVariable(variable, "levels", String(existing.maxValue));
        }
        delete existing.minValue;
        delete existing.maxValue;
        this.updateVariable(variable, "value", "string");
      }
      this.updateVariable(variable, "levels", value);
    }
  }

  /**
   * Iterates through the entire metadata options object by calling processMetadata() to act upon each of the 
   * individual fields at one time. 
   *
   * @async
   * @param {*} metadata - Metadata options that contains all the metadata according to Psych-DS formatting. 
   */
  async updateMetadata(metadata) {
    for (const key in metadata) {
      await this.processMetadata(metadata, key);    // can refactor this to include: key, metadata[value] -> change in method
    }
  }

  /**
   * This is the method that processes each individual element of the metadata options to be updated. This can be called through generate or outside of it, 
   * and this processes each element. 
   *
   * @private
   * @param {*} metadata - An object that contains all of the metadata. This is used to access the value. 
   * @param {*} key - String key that denotes what key-value mapping is being iterated upon. 
   */
  private processMetadata(metadata: {}, key: string) {
    const value = metadata[key];

    // iterating through variables metadata
    if (key === "variables") {
      if (typeof value !== "object" || value === null) {
        console.warn("Variable object is either null or incorrect type");
        return;
      }

      // all of the variables must already exist because should have datapoints
      for (let variable_key in value) {
        if (!this.containsVariable(variable_key)) {
          console.warn("Metadata does not contain variable:", variable_key);
          continue;
        }

        const variable_parameters = value[variable_key];

        if (typeof variable_parameters !== "object" || variable_parameters === null) {
          console.warn(
            "Parameters of variable:",
            variable_key,
            "is either null or incorrect type. The value",
            variable_parameters,
            "is either null or not an object."
          );
          continue;
        }

        // calling updates for each of the renamed parameters within variable/errors handled by method call
        for (const parameter in variable_parameters) {
          const parameter_value = variable_parameters[parameter];
          this.updateVariable(variable_key, parameter, parameter_value);
          if (parameter === "name") variable_key = parameter_value; // renames future instances if changing name
        }
      }
    } // iterating through each individual author class
    else if (key === "author") {
      if (typeof value !== "object" || value === null) {
        console.warn("Author object is not correct type");
        return;
      }

      for (const author_key in value) {
        const author = value[author_key];

        if (typeof author !== "string" && !("name" in author)) author["name"] = author_key; // handles string case and empty name (uses handle)

        this.setAuthor(author);
      }
    } else this.setMetadataField(key, value);
  }

  /**
   * Registers the top-level keys of a plain JSON object as dotted sub-variables
   * (e.g. response.Q0, response.Q1) and registers the parent with value: "object".
   * One level deep only.
   */
  private async expandObjectFields(parentName: string, obj: Record<string, any>, pluginType: string, version: string) {
    // Register the parent through the normal path so the plugin description is fetched.
    // typeof obj === "object", so generateMetadata stores value: "object" and updateFields
    // skips levels automatically — no override needed.
    await this.generateMetadata(parentName, obj, pluginType, version);
    for (const key of Object.keys(obj)) {
      await this.generateMetadata(`${parentName}.${key}`, obj[key], pluginType, version);
    }
  }

  /**
   * Gets the description of a variable in a plugin by fetching the source code of the plugin
   * from a remote source (usually unpkg.com) as a string, passing the script to getJsdocsDescription
   * to extract the description for the variable (present as JSDoc); caches the result for future use.
   *
   * @param {string} pluginType - The type of the plugin for which information is to be fetched.
   * @param {string} variableName - The name of the variable for which information is to be fetched.
   * @param {string} version - The version of the plugin or extension
   * @param {string} extension - Boolean indicating if pluginType refers to extension
   * @returns {Promise<string|null>} The description of the plugin variable if found, otherwise null.
   * @throws Will throw an error if the fetch operation fails.
   */
  private async getPluginInfo(pluginType: string, variableName: string, version, extension?) {
    return this.pluginCache.getPluginInfo(pluginType, variableName, version, this.verbose, extension);
  }
}

export {
  AuthorFields,
  VariableFields
}
export { analyzeJoinKeys, parseCSV } from "./utils";
export type { JoinKeyAnalysis } from "./utils";
