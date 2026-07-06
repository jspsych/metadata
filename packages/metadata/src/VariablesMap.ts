/**
 * Interface that defines the type for the fields that are specified for variables
 * according to Psych-DS regulations, with name being the one required field.
 *
 * @export
 * @interface VariableFields
 * @typedef {VariableFields}
 */
export interface VariableFields {
  "@type"?: string;
  name: string; // required
  description?: string | Record<string, string>;
  value?: string; // string, boolean, or number
  identifier?: string; // identifier that distinguish across dataset (URL), confusing should check description
  minValue?: number;
  maxValue?: number;
  levels?: string[] | []; // technically property values in the other one but not sure how to format it
  levelsOrdered?: boolean;
  na?: boolean;
  naValue?: string;
  alternateName?: string;
  privacy?: string;
}

/**
 * Custom class that stores and handles the storage, update and retrieval of variable metadata.
 *
 * @export
 * @class VariablesMap
 * @typedef {VariablesMap}
 */
export class VariablesMap {
  /**
   * Field that holds a map of the current variables allowing for fast look-up.
   *
   * @private
   * @type {{ [key: string]: VariableFields }}
   */
  private variables: { [key: string]: VariableFields };

  /**
   * Per-variable Set mirroring each variable's `levels` array, used for O(1) dedup while the
   * serialized `levels` field stays a string[] in insertion order. Keyed by the stored variable
   * object reference (a getter that returns a copy never poisons this). Rebuilt lazily from the
   * array the first time a variable is seen (e.g. levels pre-loaded from an existing dataset).
   *
   * @private
   */
  private levelsSets: WeakMap<object, Set<string>> = new WeakMap();

  /**
   * Optional opt-in cap on the number of distinct levels stored per variable. `null` (default)
   * means no cap — the stress suite codifies that there is NO default limit. When set, further
   * distinct levels past the cap are dropped and a one-time warning is logged per variable.
   *
   * @private
   */
  private levelsCap: number | null = null;
  private levelsCapWarned: Set<string> = new Set();

  /**
   *  Creates the VariablesMap by initialising an empty variable map. The jsPsych system
   * variables (trial_type, trial_index, time_elapsed, extension_*) are NOT seeded here — they
   * are registered lazily when their column is actually observed in the data (see
   * {@link registerSystemVariable}). Seeding them unconditionally produced orphan
   * variableMeasured entries (e.g. time_elapsed) for datasets that omit those columns, which
   * fails Psych-DS validation (VARIABLE_MISSING_FROM_CSV_COLUMNS).
   *
   * @constructor
   */
  constructor() {
    this.generateDefaultVariables();
  }

  /**
   * The fixed jsPsych definition for a system column, or null if `name` is not a known system
   * variable. Returns a fresh object on each call so callers never share/mutate one template.
   */
  private static systemVariableTemplate(name: string): VariableFields | null {
    switch (name) {
      case "trial_type":
        return {
          "@type": "PropertyValue",
          name: "trial_type",
          description: { default: "unknown", jsPsych: "The name of the plugin used to run the trial." },
          value: "string",
        };
      case "trial_index":
        return {
          "@type": "PropertyValue",
          name: "trial_index",
          description: { default: "unknown", jsPsych: "The index of the current trial across the whole experiment." },
          value: "number",
        };
      case "time_elapsed":
        return {
          "@type": "PropertyValue",
          name: "time_elapsed",
          description: {
            default: "unknown",
            jsPsych: "The number of milliseconds between the start of the experiment and when the trial ended.",
          },
          value: "number",
        };
      case "extension_type":
        return {
          "@type": "PropertyValue",
          name: "extension_type",
          description: { default: "unknown", jsPsych: "The name(s) of the extension(s) used in the trial." },
          value: "string",
        };
      case "extension_version":
        return {
          "@type": "PropertyValue",
          name: "extension_version",
          description: { default: "unknown", jsPsych: "The version(s) of the extension(s) used in the trial." },
          value: "number",
        };
      default:
        return null;
    }
  }

  /**
   * Lazily registers the default jsPsych definition for a system column the first time it is
   * observed in the data. No-op (returns false) when `name` is not a known system variable or
   * is already present; returns true when a new variable was registered. This is what keeps a
   * system variable out of variableMeasured unless the data actually contains that column.
   *
   * @param {string} name - The column / system-variable name.
   * @returns {boolean} - True if a variable was registered, false otherwise.
   */
  registerSystemVariable(name: string): boolean {
    if (this.containsVariable(name)) return false;
    const template = VariablesMap.systemVariableTemplate(name);
    if (!template) return false;
    this.setVariable(template);
    return true;
  }

  /**
   * Initialises the variable map. System variables are registered lazily (see the constructor
   * and {@link registerSystemVariable}), so this just resets the map to empty.
   */
  generateDefaultVariables(): void {
    this.variables = {};
  }

  /**
   * Opt-in cap on the number of distinct levels stored per variable. Threaded from generate()'s
   * options. `null` disables the cap (the default). Not a default limit — the stress suite relies
   * on no cap being applied unless a caller explicitly asks for one.
   */
  setLevelsCap(cap: number | null): void {
    this.levelsCap = cap;
  }

  /**
   * Returns a list of the variables instead of an object according to the Psych-DS format.
   *
   * This is a GETTER and must never mutate stored state. Each variable is shallow-copied and its
   * description is collapsed on a copy, so calling getMetadata()/getList() then generate() again
   * (the CLI's multi-file flow) can't corrupt the stored per-plugin description maps.
   *
   * @returns {{}[]} - The list of variables represented as objects.
   */
  getList(): {}[] {
    var var_list = [];

    for (const key of Object.keys(this.variables)) {
      // Shallow copy the variable; collapseDescription itself works on a copy of the description
      // map, so the stored object (and its nested description) is left untouched.
      const variable = { ...this.variables[key] };
      variable["description"] = this.collapseDescription(variable["description"]);
      var_list.push(variable);
    }
    return var_list;
  }

  /**
   * Collapses an internal { pluginType: description } map into a single schema.org-valid
   * Text value. Descriptions are stored per-plugin and only ever hold multiple keys when the
   * texts genuinely differ (identical texts are merged upstream in updateDescription). Psych-DS /
   * schema.org require `description` to be Text, so an object value triggers an OBJECT_TYPE_MISSING
   * validator warning — this folds everything down to a string.
   *
   * @private
   * @param {*} description - The description value (a { pluginType: text } map, or already a string).
   * @returns {string} - A single Text description.
   */
  private collapseDescription(description): string {
    // Already collapsed (string from a prior getList, or a user-set description) — leave untouched.
    if (typeof description !== "object" || description === null) {
      return description;
    }

    // Operate on a copy — this is called from the getList() getter and must not mutate the
    // stored per-plugin description map (doing so corrupted descriptions across a second
    // generate() pass in the CLI's multi-file flow).
    const desc = { ...description };

    if (Object.keys(desc).length === 0) {
      console.error("Empty description");
      return "unknown";
    }

    // The user-edited default (the frontend stores user text as { default: userText, jsPsych: … })
    // must win — never silently discard it. It only counts as real user text when it isn't the
    // synthetic "unknown" placeholder; only then is it dropped in favour of plugin descriptions.
    const userDefault =
      "default" in desc && desc["default"] !== "unknown" ? String(desc["default"]) : null;
    delete desc["default"];

    // Remaining plugin descriptions, dropping placeholder "unknown" entries.
    const pluginDescriptions = (Object.values(desc) as string[]).filter((v) => v !== "unknown");

    // User text leads; identical texts are de-duplicated while preserving order.
    const parts = userDefault !== null ? [userDefault, ...pluginDescriptions] : pluginDescriptions;
    if (parts.length === 0) return "unknown";
    return [...new Set(parts)].join(" | ");
  }

  /**
   * Allows user to set a variable and includes all the fields that are possible according to
   * Psych-DS guidelines. Only requires the name field which it uses a key to map to the variable.
   * Can also be used to overwrite existing variables if they have the same name.
   *
   * @param {VariableFields} variable - The fields of the variable that is being created.
   */
  setVariable(variable: VariableFields): void {
    if (!variable.name) {
      // Ensure name is provided
      console.warn("Name field is missing. Variable not added.", variable);
      return;
    }

    this.variables[variable.name] = variable;

    const unexpectedFields = Object.keys(variable).filter(
      (key) =>
        ![
          "@type",
          "name",
          "description",
          "value",
          "identifier",
          "minValue",
          "maxValue",
          "levels",
          "levelsOrdered",
          "na",
          "naValue",
          "alternateName",
          "privacy",
        ].includes(key)
    );
    if (unexpectedFields.length > 0) {
      console.warn(
        `Unexpected fields (${unexpectedFields.join(
          ", "
        )}) detected and included in the variable object.`
      );
    }
  }

  /**
   * Allows you to get information for a single variable returning empty dict if it doesn't exist.
   * Allows you to update fields but not recommended in favor of updateVariable.
   *
   * @param {string} name
   * @returns {(VariableFields | {})} - Variable information or empty dict if doesn't exist
   */
  getVariable(name: string): VariableFields | {} {
    return this.variables[name] || {};
  }

  /**
   * Checks if variable exists in VariablesMap.
   *
   * @param {string} name - Name of variable
   * @returns {boolean} - True if exists, false if doesn't.
   */
  containsVariable(name: string): boolean {
    return name in this.variables;
  }

  /**
   * Method that gets a list of the names of variables.
   *
   * @returns {string[]} - String list containing names of existing variables.
   */
  getVariableNames(): string[] {
    var var_list = [];
    for (const key of Object.keys(this.variables)) {
      var_list.push(this.variables[key]["name"]);
    }

    return var_list;
  }

  /**
   * Allows you to update a variable or add a value in the case of updating values. In other situations will
   * replace the existing value with the new value. Has special cases and logic for levels and names making it
   * easier to update variable values.
   *
   *
   * @param {string} var_name - Name of variable to be updated.
   * @param {string} field_name - Specific field to be updated.
   * @param {(string | boolean | number | { [key: string]: string })} added_value - Single value to be updated, with a mapping if adding to description with key representing pluginType.
   */
  updateVariable(
    var_name: string,
    field_name: string,
    added_value: string | boolean | number | { [key: string]: string }
  ): void {
    const updated_var = this.getVariable(var_name);

    if (Object.keys(updated_var).length === 0) {
      // error checking to see variable exists
      console.error(`Variable "${var_name}" does not exist.`);
      return;
    }

    if (field_name === "levels") {
      this.updateLevels(updated_var, added_value);
    } else if (field_name === "minValue" || field_name === "maxValue") {
      this.updateMinMax(updated_var, added_value, field_name);
    } else if (field_name === "description") {
      this.updateDescription(updated_var, added_value);
    } else if (field_name === "name") {
      this.updateName(updated_var, added_value);
    } else {
      updated_var[field_name] = added_value;
    }
  }

  /**
   * Logic that handles updates to levels field by creating new array if necessary, otherwise
   * pushing the value if it doesn't already exist. Levels can only be added to with strings.
   *
   * @private
   * @param {*} updated_var - The variable object to be updated.
   * @param {*} added_value - The value being added to the levels field.
   */
  private updateLevels(updated_var, added_value): void {
    // Objects/arrays/null are not valid levels (levels is a string[]).
    if (typeof added_value === "object") return;

    // The public API accepts booleans/numbers; levels is a string[], so stringify primitives
    // (e.g. true -> "true", 5 -> "5") rather than storing a raw non-string in the array.
    let level: string = typeof added_value === "string" ? added_value : String(added_value);

    const MAX_LENGTH = 50; // Define the maximum length for the added value
    // Trim the added value if it exceeds the maximum length
    if (level.length > MAX_LENGTH) {
      level = level.substring(0, MAX_LENGTH) + "...";
    }

    if (!Array.isArray(updated_var["levels"])) {
      updated_var["levels"] = [];
    }

    // Maintain a Set alongside the array so membership is O(1) instead of O(n) — a column with
    // tens of thousands of distinct values would otherwise be O(n^2). The array remains the
    // serialized, insertion-ordered string[]. The Set is rebuilt from the array the first time
    // this variable object is seen (covers levels pre-loaded from an existing dataset).
    let seen = this.levelsSets.get(updated_var);
    if (!seen) {
      seen = new Set(updated_var["levels"]);
      this.levelsSets.set(updated_var, seen);
    }

    if (seen.has(level)) return;

    if (this.levelsCap !== null && updated_var["levels"].length >= this.levelsCap) {
      const name = updated_var["name"];
      if (!this.levelsCapWarned.has(name)) {
        this.levelsCapWarned.add(name);
        console.warn(
          `Variable "${name}" reached the configured levelsCap (${this.levelsCap}); additional distinct levels are dropped.`
        );
      }
      return;
    }

    seen.add(level);
    updated_var["levels"].push(level);
  }

  /**
   * Logic to update the min and max for the specific value.
   *
   * @private
   * @param {*} updated_var - The variable object to be updated.
   * @param {*} added_value - The value that is being checked against current min/max.
   * @param {*} field_name - The name of field that is being checked (min or max).
   */
  private updateMinMax(updated_var, added_value, field_name): void {
    // Initialise only the bound(s) that are actually missing. The old guard reset BOTH bounds
    // whenever either was absent, so a user who pre-set only minValue would have it overwritten
    // by the first observed value.
    if (!("minValue" in updated_var)) {
      updated_var["minValue"] = added_value;
    }
    if (!("maxValue" in updated_var)) {
      updated_var["maxValue"] = added_value;
    }

    // redundant checks, including them because of current formatting but want to delete field_name
    if (field_name === "minValue" && updated_var["minValue"] > added_value) {
      updated_var["minValue"] = added_value;
    } else if (field_name === "maxValue" && updated_var["maxValue"] < added_value) {
      updated_var["maxValue"] = added_value;
    }
  }

  /**
   * Logic for updating description field that checks to see value already exists. If it does,
   * appends the pluginType to the current key and pushes that along with the value. Creates
   * map if it does not exist.
   *
   * @private
   * @param {*} updated_var - The variable to be updated.
   * @param {*} added_value - The value to be added with the key being the name of the plugin and the key being the description field.
   */
  private updateDescription(updated_var, added_value): void {
    // A plain string description (e.g. generate() options { variables: { rt: { description:
    // "Reaction time" } } }, or a user-typed value) is treated as the user's default text. Without
    // this, Object.keys("Reaction time") spread the string char-by-char into {"0":"R","1":"e",…}.
    if (typeof added_value === "string") {
      added_value = { default: added_value };
    }

    if (typeof added_value !== "object" || added_value === null) {
      console.error("Description update passed in bad format", added_value);
      return;
    }

    // getting key and value for new value for clarity
    const add_key = Object.keys(added_value)[0];
    const add_value = Object.values(added_value)[0];

    // Guard against an empty object ({}), where Object.keys()[0] is actually undefined.
    // (Previously this compared to the STRING "undefined", which never matched.)
    if (add_key === undefined || add_value === undefined) {
      console.error("New value is passed in bad format", added_value);
      return;
    }

    var exists = false;
    // Convert non-object descriptions to object form before merging.
    // Preserve meaningful string descriptions as { default: string } so that
    // user-written descriptions loaded from an existing JSON survive a re-run
    // of generate(). "unknown" and other falsy values are treated as empty.
    if (typeof updated_var["description"] !== "object") {
      const existing = updated_var["description"];
      updated_var["description"] = (typeof existing === "string" && existing && existing !== "unknown")
        ? { default: existing }
        : {};
    }

    // appends key to other keys if default value/description are the same already exist to keep metadata shorter
    Object.entries(updated_var["description"]).forEach(([key, value]) => {
      if (value === add_value) {
        if (!key.includes(add_key)) {
          // substring check to see it doesn't exist
          delete updated_var["description"][key]; // deletes old version
          updated_var["description"][key + ", " + add_key] = add_value;
        }
        exists = true;
      }
    });

    // if value description doesn't exist previous, adds
    if (!exists) Object.assign(updated_var["description"], added_value); // Assuming added_value is { chatplugin: "response that user input" }
  }

  /**
   * Logic for updating name. Needs to retain all the old values while creating a new reference in the map
   * while keeping the same perspe
   *
   * @private
   * @param {*} updated_var
   * @param {*} added_value
   */
  private updateName(updated_var, added_value): void {
    const old_name = updated_var["name"];

    // Refuse to rename to an empty/falsy or non-string name — doing so previously made the
    // variable vanish (it got keyed under "" / undefined and dropped from getVariableNames).
    if (typeof added_value !== "string" || added_value === "") {
      console.warn(
        `Cannot rename variable "${old_name}" to an empty or non-string name. Rename skipped.`
      );
      return;
    }

    if (added_value === old_name) return; // no-op rename

    // Refuse to rename onto an existing variable — doing so silently deleted the target.
    if (this.containsVariable(added_value)) {
      console.warn(
        `Cannot rename variable "${old_name}" to "${added_value}": a variable with that name already exists. Rename skipped.`
      );
      return;
    }

    updated_var["name"] = added_value;
    delete this.variables[old_name];

    this.setVariable(updated_var);
  }

  /**
   * Allows you to delete a variable by key/name. Returns console error if not found.
   *
   * @param {string} var_name - Name of variable to be deleted.
   */
  deleteVariable(var_name: string): void {
    if (var_name in this.variables) {
      delete this.variables[var_name];
    } else {
      console.error(`Variable "${var_name}" does not exist.`);
    }
  }
}
