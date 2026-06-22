import { AuthorFields, AuthorsMap } from "./AuthorsMap";
import { PluginCache } from "./PluginCache";
import { saveTextToFile, parseCSV, tryParseJSON, parseJsonData, analyzeJoinKeys, JoinKeyAnalysis, SYSTEM_COLUMNS, stripUnnamedColumns } from "./utils";
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
  // Plain (non-array) object columns expanded by expandObjectFields. One row per trial,
  // keyed by the same arrayJoinKeys as extractedArrays, with a column for every dotted
  // descendant variable (leaf scalars, intermediate object nodes, and nested-array parents).
  // The CLI writes these as separate Psych-DS CSVs so those dotted names map to real columns.
  private extractedObjects: Map<string, Array<Record<string, any>>> = new Map();
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
   * Returns accumulated plain-object-column data keyed by the top-level column name.
   * Each entry is one row per trial: the join key columns plus a column for every dotted
   * descendant variable expanded from that object (matching the names in variableMeasured).
   * Used by the CLI to write a separate Psych-DS CSV per object column, so those dotted
   * sub-variables resolve to real columns. No element_index (one row per trial, not per element).
   */
  getExtractedObjects(): Map<string, Array<Record<string, any>>> {
    return this.extractedObjects;
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
   * This method accepts data as a JSON string, a CSV string, or an already-parsed array of
   * observation objects. A string is parsed according to `ext`; an array is consumed as-is.
   * Each observation is processed asynchronously via `generateObservation`. Optionally, metadata
   * options can be provided as an object, and each key-value pair is processed by `processMetadata`.
   *
   * NOTE: when `data` is a pre-parsed array it is consumed in place and MUTATED — unnamed
   * (blank-header) columns are deleted from the row objects. Callers that need the rows to stay
   * pristine must pass a copy. This lets a caller parse a file once and share the rows with
   * generate() instead of having generate() re-parse the same content.
   *
   * @async
   * @param {Array|String} data - Observations to generate from: a pre-parsed array (consumed as-is and mutated in place), a JSON string, or a CSV string.
   * @param {Object} [metadata={}] - Optional metadata to be processed. Each key-value pair in this object will be processed individually.
   * @param {'json'|'csv'} [ext='json'] - Format of a string `data`; ignored when `data` is already an array.
   * @param {Object} [options={}] - arrayJoinKeys / suppressJoinKeyWarning, plus synthesizedSourceRecordId for pre-parsed callers that tagged a synthetic source_record_id themselves.
   */
  async generate(data, metadata = {}, ext = 'json', options: { arrayJoinKeys?: string[]; suppressJoinKeyWarning?: boolean; synthesizedSourceRecordId?: boolean } = {}) {
    this.extractedArrays = new Map();
    this.extractedObjects = new Map();
    this.arrayJoinKeys = options.arrayJoinKeys ?? ['trial_index'];

    var parsed_data;

    // Accept data already parsed by the caller (an array of observations) so a file isn't
    // parsed twice when the caller also needs the rows — e.g. the CLI/web conversion path,
    // which builds the main CSV from these same rows. A pre-parsed caller owns any
    // source_record_id tagging and tells us whether it synthesized one via options; when we
    // parse a JSON string ourselves we derive it from the parse below.
    let synthesizedSourceRecordId = options.synthesizedSourceRecordId ?? false;
    if (Array.isArray(data)) {
      parsed_data = data;
    } else if (ext === 'csv') {
      parsed_data = await parseCSV(data);
    } else if (ext === 'json') {
      // Accepts both a single JSON array (standard jsPsych export) and JSON-Lines,
      // where each line is its own JSON value (JATOS exports one participant array per line).
      // Tag JSON-Lines rows with a per-line source_record_id: raw jsPsych exports carry no
      // per-row identifier, so in multi-record JSONL trial_index alone repeats across records
      // and can't uniquely key the extracted sidecar CSVs. The stat records whether we actually
      // invented the id (vs. the data already carrying one), so we only describe it as
      // synthetic when it truly is.
      const parseStats: { synthesizedSourceRecordId?: boolean } = {};
      parsed_data = parseJsonData(data, { tagSourceRecordId: true }, parseStats);
      synthesizedSourceRecordId = parseStats.synthesizedSourceRecordId === true;
    }

    if (!Array.isArray(parsed_data)) {
      throw new Error("Parsed data is not in correct format: Expected an array of observations");
    }

    // Drop unnamed columns (empty/whitespace-only headers) before processing. These can't be
    // represented in variableMeasured (Psych-DS requires a name) and are typically R's row-index
    // column. Stripping here removes them from variableMeasured and avoids a per-row warning in
    // setVariable. buildPsychDSDataFiles mirrors this on the written CSV so file and metadata sync.
    const { dropped } = stripUnnamedColumns(parsed_data as Array<Record<string, any>>);
    if (dropped.length > 0) {
      console.warn(
        `Dropped ${dropped.length} unnamed column${dropped.length > 1 ? "s" : ""} from the data — ` +
          `Psych-DS requires every column to have a name (usually a row-index column added by R's ` +
          `write.csv). Excluded from variableMeasured.`
      );
    }

    // When JSON rows carry an identifier column, promote it to the leading join key (unless the
    // caller already listed it). Prefer source_record_id (synthesized per line from JSON-Lines
    // above) and otherwise fall back to a real participant_id already present in the export. Raw
    // jsPsych exports otherwise have no per-row identifier, so trial_index alone repeats across
    // records and can't uniquely key the extracted sidecar CSVs; (id, trial_index, …) restores a
    // one-trial-per-key join. CSV inputs are left untouched, preserving existing behaviour for
    // tabular sources.
    const rows = parsed_data as Array<Record<string, any>>;
    const hasColumn = (col: string) =>
      ext === 'json' && rows.some((row) => row && typeof row === 'object' && col in row);
    const idColumn = hasColumn('source_record_id') ? 'source_record_id'
      : hasColumn('participant_id') ? 'participant_id'
      : undefined;
    if (idColumn && !this.arrayJoinKeys.includes(idColumn)) {
      this.arrayJoinKeys = [idColumn, ...this.arrayJoinKeys];
    }

    // Callers that already surface join-key uniqueness to the user (e.g. the CLI's
    // interactive pre-analysis prompt) can suppress this warning to avoid repeating it
    // once per file.
    const analysis = analyzeJoinKeys(parsed_data as Array<Record<string, any>>, this.arrayJoinKeys);
    if (!analysis.isUnique && !options.suppressJoinKeyWarning) this.warnJoinKeyUniqueness(analysis);

    for (const observation of parsed_data) {
      await this.generateObservation(observation);
    }

    // Only when WE synthesized source_record_id (it wasn't in the source) do we own its
    // description. As an identifier/join-key column it isn't plugin-documented, so per-trial
    // processing leaves it with only "unknown" plugin descriptions that getList() strips to an
    // empty {} (an object with no @type → OBJECT_TYPE_MISSING). Give it one explicit
    // description that makes its synthetic origin unmistakable, so a downstream user never
    // mistakes it for a real subject ID. A pre-existing participant_id is left untouched — its
    // meaning is the experiment's, not ours. Done before updateMetadata so a caller-supplied
    // metadata override still wins.
    if (synthesizedSourceRecordId && this.containsVariable('source_record_id')) {
      const existing = this.getVariable('source_record_id') as VariableFields;
      this.setVariable({
        ...existing,
        description: { default: 'Synthetic source-record identifier (0-based), assigned one per source record (one JSON-Lines line, which is usually but not always one participant) because the raw data carried no identifier column. NOT a real subject ID from the experiment — it only orders/links records as they appeared in the source file, and serves as a join key connecting each trial to its extracted array/object rows.' },
      });
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

    // extension_type / extension_version are jsPsych system columns and register lazily in the
    // column loop below (registerSystemVariable), exactly like trial_type / trial_index /
    // time_elapsed. We deliberately do NOT seed them eagerly here: doing so registered both vars
    // whenever extension_type appeared, orphaning extension_version in variableMeasured for any
    // dataset that lacks that column (the #109 VARIABLE_MISSING_FROM_CSV_COLUMNS failure mode).

    // Join key values for this row, shared by every array column (top-level or nested)
    // extracted into a separate CSV during this observation.
    const joinValues = this.arrayJoinKeys.reduce((acc, k) => { acc[k] = observation[k]; return acc; }, {} as Record<string, any>);

    for (const variable in observation) {
      var value = observation[variable];
      var type: string = typeof value;

      // Ensure every column header appears in variableMeasured even if all its values are null/empty.
      // Columns that never get a real value keep value:"unknown" and no levels, which satisfies the
      // Psych-DS requirement that every CSV column header has a corresponding variableMeasured entry.
      if (!this.containsVariable(variable)) {
        if (this.ignored_variables.has(variable)) {
          // System columns (trial_type, time_elapsed, …) carry fixed jsPsych descriptions and are
          // registered lazily here — only when the column actually appears in the data. This keeps
          // datasets that omit a system column (e.g. processed exports without time_elapsed) from
          // getting an orphan variableMeasured entry that fails Psych-DS validation.
          this.variables.registerSystemVariable(variable);
        } else {
          this.setVariable({
            "@type": "PropertyValue",
            name: variable,
            description: { default: "unknown" },
            value: "unknown",
          });
        }
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
          // NOTE: "true"/"false" strings are intentionally left as strings (not coerced to
          // boolean) so they accumulate as levels ["true","false"]. Only genuine booleans
          // (typeof value === "boolean", e.g. from JSON data) are typed "boolean", and those
          // get no levels — see updateFields.
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
          // Accumulate one row per trial for a separate CSV so every dotted sub-variable that
          // expandObjectFields registers resolves to a real column (Psych-DS requires every
          // variableMeasured name to be a CSV column). The row is threaded through the recursion
          // so deep descendants are captured under their full dotted names; reuses the same
          // configurable arrayJoinKeys — no object-specific join-key logic. The parent column
          // itself already exists in the main CSV, so only descendants go in the sidecar.
          const objectRow: Record<string, any> = { ...joinValues };
          await this.expandObjectFields(variable, value, pluginType, version, joinValues, objectRow);
          const existingObjects = this.extractedObjects.get(variable) ?? [];
          existingObjects.push(objectRow);
          this.extractedObjects.set(variable, existingObjects);
        } else if (type === "array" || (type === "object" && Array.isArray(value))) {
          // Register parent via generateMetadata to get the plugin description, then
          // override the stored type to "array" (generateMetadata would infer "object"
          // because typeof [] === "object" in JS).
          await this.generateMetadata(variable, value, pluginType, version);
          // Only force "array" if the existing type is not a concrete primitive type.
          // Avoids overwriting e.g. "string" on mixed-type jsPsych columns like `response`
          // (string in keyboard trials, array/object in survey trials), while still correctly
          // upgrading "unknown" and "object" (typeof [] === "object" in JS) to "array"
          // for pure array-typed columns.
          const existingVar = this.containsVariable(variable)
            ? (this.getVariable(variable) as VariableFields)
            : null;
          const existingType = existingVar?.value;
          if (existingType !== "string" && existingType !== "number" && existingType !== "boolean") {
            this.updateVariable(variable, "value", "array");
          }
          await this.accumulateArrayColumn(variable, value as any[], joinValues, pluginType, version);
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
    const type = typeof value;

    // Register the column (or upgrade a value:"unknown" placeholder) with its concrete type. This is
    // independent of the plugin: a row without a trial_type still has typed columns whose values must
    // feed min/max and levels — only the human-readable description (below) comes from the plugin.
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

    // Plugin/extension description lookup needs a plugin type. Rows without one (e.g. a row missing
    // trial_type) keep the default "unknown" description but are still typed and counted.
    if (pluginType) {
      const pluginInfo = await this.getPluginInfo(pluginType, variable, version, extension);
      const description = pluginInfo["description"];
      const new_description = description
        ? { [pluginType]: description }
        : { [pluginType]: "unknown" };
      this.updateVariable(variable, "description", new_description);
    }

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
    // Boolean variables are self-describing through value:"boolean" — true/false carry no
    // additional information as levels, so we record no levels (or min/max) for them. This also
    // avoids pushing raw booleans into the levels array (which is meant to hold strings).
    if (type === "boolean") return;

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
      // F2: a column already typed boolean (a genuine true/false was seen) may also receive the
      // STRING "true"/"false" — e.g. the same field encoded as text in another row. Treat it as the
      // same boolean rather than recording a misleading categorical level. Any other string still
      // accumulates as a level (a real mix).
      if (existing.value === "boolean" && (value === "true" || value === "false")) {
        return;
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
          // A user-chosen value:"boolean" override warns if the detected values aren't boolean-like
          // and drops any detected levels/min/max (booleans carry none — see updateFields).
          if (parameter === "value" && parameter_value === "boolean") {
            this.applyBooleanOverride(variable_key);
          }
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
   * Applies a user-chosen `value:"boolean"` override to an already-populated variable.
   * Warns when the values detected from the data don't map cleanly to boolean logic
   * (anything other than true/false/0/1, case-insensitive), then drops the detected
   * levels/min/max so the variable matches how genuine booleans are recorded (no levels).
   */
  private applyBooleanOverride(variableName: string) {
    // getVariable returns the live stored object, so the deletes below take effect in place
    // (same pattern as updateFields).
    const existing = this.getVariable(variableName) as VariableFields;

    const isBooleanLike = (v: unknown): boolean => {
      const s = String(v).trim().toLowerCase();
      return s === "true" || s === "false" || s === "0" || s === "1";
    };

    const offenders = new Set<string>();
    if (Array.isArray(existing.levels)) {
      for (const level of existing.levels) if (!isBooleanLike(level)) offenders.add(String(level));
    }
    if (typeof existing.minValue === "number" && !isBooleanLike(existing.minValue)) offenders.add(String(existing.minValue));
    if (typeof existing.maxValue === "number" && !isBooleanLike(existing.maxValue)) offenders.add(String(existing.maxValue));

    if (offenders.size > 0) {
      const sample = [...offenders].slice(0, 10).join(", ");
      const more = offenders.size > 10 ? `, …(+${offenders.size - 10} more)` : "";
      console.warn(
        `Variable "${variableName}" was set to value:"boolean", but the detected values don't map cleanly to true/false: ${sample}${more}. Double-check this is the intended type.`
      );
    }

    // Booleans carry no levels/min/max; drop any detected so the override is consistent.
    delete existing.levels;
    delete existing.minValue;
    delete existing.maxValue;
  }

  /**
   * Registers the keys of a plain JSON object as dotted sub-variables
   * (e.g. response.Q0, response.Q1) and registers the parent with value: "object".
   *
   * Recurses into nested plain objects so structures more than one level deep are
   * fully expanded (e.g. response.address.city). Nested arrays are registered with
   * value: "array" (typeof [] === "object", so the inferred type must be overridden)
   * and, when they hold objects, extracted into a separate CSV keyed by their dotted
   * column name — mirroring how top-level array columns are handled.
   *
   * @param joinValues - The current row's join key values, prepended to every
   *   extracted nested-array row so the sub-table can be rejoined to the main data.
   */
  private async expandObjectFields(parentName: string, obj: Record<string, any>, pluginType: string, version: string, joinValues: Record<string, any>, row?: Record<string, any>) {
    // Register the parent through the normal path so the plugin description is fetched.
    // typeof obj === "object", so generateMetadata stores value: "object" and updateFields
    // skips levels automatically — no override needed.
    await this.generateMetadata(parentName, obj, pluginType, version);
    for (const key of Object.keys(obj)) {
      const childName = `${parentName}.${key}`;
      const childValue = obj[key];

      // Record every descendant under its dotted name in the object's sidecar row, so each
      // registered variableMeasured name (scalar leaf, intermediate object node, or nested-array
      // parent) has a matching column. Object/array values are JSON-stringified at CSV-write time.
      if (row) row[childName] = childValue;

      if (childValue !== null && typeof childValue === "object" && !Array.isArray(childValue)) {
        // Nested plain object — recurse so its keys are expanded too (into the same sidecar row).
        await this.expandObjectFields(childName, childValue, pluginType, version, joinValues, row);
      } else if (Array.isArray(childValue)) {
        // Nested array — register the description, override the inferred "object" type,
        // and extract any object elements into a separate CSV.
        await this.generateMetadata(childName, childValue, pluginType, version);
        this.updateVariable(childName, "value", "array");
        await this.accumulateArrayColumn(childName, childValue, joinValues, pluginType, version);
      } else {
        await this.generateMetadata(childName, childValue, pluginType, version);
      }
    }
  }

  /**
   * Accumulates the object elements of an array column into `extractedArrays` for
   * separate Psych-DS CSV output, keyed by the column's (possibly dotted) name.
   * Each emitted row is the join key values, an `element_index`, then the element's
   * fields under DOTTED names (`columnName.field`) so they don't collide with top-level
   * columns or with fields of other array columns. Every emitted column is registered in
   * variableMeasured so the sidecar CSV has no columns missing from the metadata.
   *
   * Element fields recurse (see expandElementFields): a nested plain object is expanded
   * into deeper dotted columns in the SAME row; a nested array is extracted into its own
   * grandchild CSV, joinable via `${columnName}.element_index` (this element's position)
   * carried alongside the existing join keys.
   *
   * Null / primitive top-level array elements are skipped; arrays with no object elements
   * produce no rows.
   */
  private async accumulateArrayColumn(columnName: string, arr: any[], joinValues: Record<string, any>, pluginType: string, version: string) {
    // Every non-empty element produces a row. Object elements expand into named columns
    // (`columnName.field`); primitive or nested-array elements have no field name, so they go
    // under a synthetic `columnName.value` column. Null/undefined elements are skipped.
    const elements: Array<{ element: any; index: number }> = [];
    arr.forEach((element, index) => {
      if (element !== null && element !== undefined) elements.push({ element, index });
    });
    if (elements.length === 0) return;

    // Declare the join-key columns this table carries that aren't known yet: element_index, plus
    // any ancestor element-index keys passed down from an enclosing array (qualified
    // "<col>.element_index"). Pre-existing keys (trial_index, source_record_id, …) are already
    // declared and are skipped.
    if (!this.containsVariable("element_index")) {
      this.setVariable({
        "@type": "PropertyValue",
        name: "element_index",
        description: { default: "Position of this element within its source array column (0-based)." },
        value: "number",
      });
    }
    for (const joinKey of Object.keys(joinValues)) {
      if (!this.containsVariable(joinKey)) {
        this.setVariable({
          "@type": "PropertyValue",
          name: joinKey,
          description: { default: "Join key referencing the position of an enclosing array element (0-based index)." },
          value: "number",
        });
      }
    }

    const existing = this.extractedArrays.get(columnName) ?? [];
    for (const { element, index } of elements) {
      const row: Record<string, any> = { ...joinValues, element_index: index };
      // Join keys for any array nested inside this element: the current keys plus THIS element's
      // index, qualified by the column name so it doesn't clash with the grandchild's own
      // element_index. This keeps a grandchild sub-table joinable to its specific parent element.
      const nestedJoin: Record<string, any> = { ...joinValues, [`${columnName}.element_index`]: index };

      if (typeof element === "object" && !Array.isArray(element)) {
        // Object element → expand its named fields (columnName.field), recursing as needed.
        await this.expandElementFields(columnName, element, row, nestedJoin, pluginType, version);
      } else {
        // Primitive (or nested-array) element → no field name, so record it under columnName.value.
        // The synthetic name differs from the array parent (value:"array") to avoid a collision.
        const valueName = `${columnName}.value`;
        row[valueName] = element;
        if (Array.isArray(element)) {
          await this.registerNodeVariable(valueName, element, "array", pluginType, version);
          await this.accumulateArrayColumn(valueName, element, nestedJoin, pluginType, version);
        } else {
          await this.registerScalarField(valueName, element, pluginType, version);
        }
      }
      existing.push(row);
    }
    this.extractedArrays.set(columnName, existing);
  }

  /**
   * Recursively records one array element's fields into `row` under dotted names. Scalars become
   * columns with type + min/max/levels tracking; nested plain objects are expanded into the SAME
   * row (deeper dotted columns); nested arrays are extracted into their own grandchild CSV via
   * accumulateArrayColumn (keyed by `nestedJoin`). Object/array nodes are also kept as a single
   * dotted JSON column so their own name is represented as a column too.
   */
  private async expandElementFields(prefix: string, obj: Record<string, any>, row: Record<string, any>, nestedJoin: Record<string, any>, pluginType: string, version: string) {
    for (const key of Object.keys(obj)) {
      const name = `${prefix}.${key}`;
      const value = obj[key];
      row[name] = value; // object/array values are JSON-stringified at CSV-write time

      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        await this.registerNodeVariable(name, value, "object", pluginType, version);
        await this.expandElementFields(name, value, row, nestedJoin, pluginType, version);
      } else if (Array.isArray(value)) {
        await this.registerNodeVariable(name, value, "array", pluginType, version);
        await this.accumulateArrayColumn(name, value, nestedJoin, pluginType, version);
      } else {
        await this.registerScalarField(name, value, pluginType, version);
      }
    }
  }

  /** Registers an object/array node variable once (with its plugin description, if any). */
  private async registerNodeVariable(name: string, value: any, type: "object" | "array", pluginType: string, version: string) {
    if (this.containsVariable(name) && (this.getVariable(name) as VariableFields).value !== "unknown") return;
    await this.generateMetadata(name, value, pluginType, version);
    if (!this.containsVariable(name)) {
      // Defensive: generateMetadata registers the column itself (even without a pluginType), but
      // declare it here too in case it is ever reached without registration.
      this.setVariable({ "@type": "PropertyValue", name, description: { default: "unknown" }, value: type });
    } else {
      this.updateVariable(name, "value", type); // typeof {}/[] === "object"; pin the intended type
    }
  }

  /**
   * Registers one scalar array-element field under its dotted name (so the sidecar column is
   * represented in variableMeasured), then folds later values into min/max/levels. Empty values
   * still declare the column (placeholder) without polluting min/max/levels.
   */
  private async registerScalarField(name: string, value: any, pluginType: string, version: string) {
    if (value === null || value === undefined || value === "" || value === "null") {
      if (!this.containsVariable(name)) {
        this.setVariable({ "@type": "PropertyValue", name, description: { default: "unknown" }, value: "unknown" });
      }
      return;
    }

    const type = typeof value;
    const needsRegister = !this.containsVariable(name) || (this.getVariable(name) as VariableFields).value === "unknown";

    if (needsRegister) {
      await this.generateMetadata(name, value, pluginType, version);
      if (!this.containsVariable(name)) {
        this.setVariable({ "@type": "PropertyValue", name, description: { default: "unknown" }, value: type });
        this.updateFields(name, value, type);
      }
    } else {
      this.updateFields(name, value, type);
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
export { analyzeJoinKeys, parseCSV, parseJsonData, unwrapTrials, isValidPsychDSDataFilename, toPsychDSValue, deriveArrayFilename, objectsToCSV, disambiguateArrayFilename, deriveFallbackBase, buildPsychDSDataFiles, stripUnnamedColumns, PSYCHDS_IGNORE_FILENAME, PSYCHDS_IGNORE_CONTENT } from "./utils";
export type { JoinKeyAnalysis, PsychDSDataFile, BuildPsychDSDataFilesArgs } from "./utils";
