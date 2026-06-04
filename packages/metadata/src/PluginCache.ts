/**
 * This class handles the fetching and extraction of description field data about variables
 * using plugin and extension type. It caches and parses it efficiently to speed up the metadata generation
 * process.
 *
 * @export
 * @class PluginCache
 * @typedef {PluginCache}
 */
export class PluginCache {
  private pluginFields: { [key: string]: {} };

  constructor() {
    this.pluginFields = {}; // caching previous results
  }

  /**
   * Gets the description of a variable in a plugin by fetching the source code of the plugin
   * from a remote source (usually unpkg.com) as a string, passing the script to getJsdocsDescription
   * to extract the description for the variable (present as JSDoc); caches the result for future use.
   *
   * @param {string} pluginType - The type of the plugin for which information is to be fetched.
   * @param {string} variableName - The name of the variable for which information is to be fetched.
   * @param {string} version - The name of the variable for which information is to be fetched. 
   * @param {boolean} verbose - Indicates whether should run with verbose mode
   * @param {boolean} [extension] - An optional flag to indicate if an extension should be used.
   * @returns {Promise<string|null>} The description of the plugin variable if found, otherwise null.
   * @throws Will throw an error if the fetch operation fails.
   */
  async getPluginInfo(pluginType: string, variableName: string, version: string, verbose: boolean, extension?: boolean) {
    // fetches if it doesn't exist
    if (!(pluginType in this.pluginFields)) {
      const fields = await this.generatePluginFields(pluginType, version, verbose, extension);
      this.pluginFields[pluginType] = fields;
    }

    if (variableName in this.pluginFields[pluginType])
      return this.pluginFields[pluginType][variableName];
    else
      return {
        description: "unknown",
        type: "unknown",
      };
  }

  /**
   * Method that handles the generation of the fields and calls helpers methods that 
   * fetch and parse the plugin data.
   *
   * @private
   * @async
   * @param {string} pluginType - Name of plugin or extension to fetch.
   * @param {string} version - String version to fetch
   * @param {boolean} verbose - Boolean indicating verbose mode
   * @param {?boolean} [extension] - Optional flag if pluginType is extension
   * @returns {unknown}
   */
  private async generatePluginFields(pluginType: string, version: string, verbose: boolean, extension?: boolean) {
    const script = await this.fetchScript(pluginType, version, verbose, extension);

    // parses if they exist
    if (script !== undefined && script !== null && script !== ""){
      try {
        return this.parseJavadocString(script);
      } 
      catch (err) {
        console.warn("* Error parsing", pluginType, err);
        return {};
      }
    }
    else {
      return {}; // returns empty if can't fetch
    }
  }

  /**
   * The method that generates the unpkg links based on whether extension vs plugin and the 
   * specific type.
   *
   * @private
   * @param {string} pluginType - Name of plugin or extension to fetch
   * @param {string} version - String version used
   * @param {?boolean} [extension] - Optional flag if pluginType is extension
   * @returns {string}
   */
  private generateUnpkg(pluginType: string, version: string, extension?: boolean){
    // webgazer is the broken one
    if (extension){
      if (version){
        return `https://unpkg.com/@jspsych/extension-${pluginType}@${version}/src/index.ts`;
      }
      else return `https://unpkg.com/@jspsych/extension-${pluginType}/src/index.ts`; // most common case - plugin with no version
    }

    // pluginLogic
    if (version){
      return `https://unpkg.com/@jspsych/plugin-${pluginType}@${version}/src/index.ts`;
    }
    else return `https://unpkg.com/@jspsych/plugin-${pluginType}/src/index.ts`; // most common case - plugin with no version
  }

  /**
   * Fetches the actual script text content from unpkg. Calls the method to generate the link 
   * and then handles error checking and fetching.
   *
   * @private
   * @async
   * @param {string} pluginType - The plugin or extension name to be fetched
   * @param {string} version - The string version of the plugin
   * @param {boolean} verbose - Boolean indicating verbose mode
   * @param {?boolean} [extension] - Whether pluginType is extension
   * @returns {unknown}
   */
  private async fetchScript(pluginType: string, version: string, verbose: boolean, extension?: boolean) {
    const unpkgUrl = this.generateUnpkg(pluginType, version, extension);

    if (verbose) console.log("-> fetching information for [", pluginType, "] from ->", unpkgUrl);

    try {
      const response = await fetch(unpkgUrl);
      if (!response.ok) {
        console.warn(`Plugin source not found for: ${pluginType} (HTTP ${response.status}). Descriptions will default to "unknown".`);
        return undefined;
      }
      const scriptContent = await response.text();
      return scriptContent;
    } catch (error) {
      console.error(
        `Plugin fetching failed for:`,
        pluginType,
        "with error",
        error,
        "Note: if you are using a plugin not supported the main JsPsych branch this will always fail."
      );
      return undefined;
    }
  }

  /**
   * Extracts the content of the top-level `data: { ... }` block from a jsPsych plugin source
   * file using brace counting. This is more robust than a regex approach because the data block
   * ends with `},` (not `};`), and plugin sources contain deeply nested objects that would
   * cause a lazy regex to stop at the wrong closing brace.
   *
   * Known limitations (acceptable for current jsPsych plugin sources):
   * - Matches the first `data:` property in the file; a plugin with a `data:` field inside its
   *   `parameters` block before the top-level `info.data` block would extract the wrong object.
   * - Brace counting treats every `{`/`}` as structural; braces inside string literals or JSDoc
   *   comments (e.g. `/** e.g. {foo: 1} *\/`) would throw off the counter.
   *
   * @private
   * @param {string} script - Full plugin source text.
   * @returns {string | null} Content between the outer braces of the data block, or null if not found.
   */
  private extractDataBlock(script: string): string | null {
    const dataStart = script.search(/\bdata:\s*\{/);
    if (dataStart === -1) return null;
    const braceStart = script.indexOf('{', dataStart);
    if (braceStart === -1) return null;
    const braceEnd = this.findMatchingBrace(script, braceStart);
    if (braceEnd === -1) return null;
    return script.substring(braceStart + 1, braceEnd);
  }

  /**
   * Parses JSDoc comments and variable blocks from the data section of a jsPsych plugin source.
   *
   * @private
   * @param {string} script - The script text content of the fetching.
   * @returns {{}}
   */
  private parseJavadocString(script: string) {
    const dataBlock = this.extractDataBlock(script);
    if (!dataBlock) return {};
    return this.extractJsdocFields(dataBlock);
  }

  /**
   * Extracts JSDoc-annotated fields from a data block string. Uses brace counting to find
   * each variable's true closing brace, then recursively processes any `nested:` sub-object
   * so that nested parameter descriptions are also captured.
   *
   * @private
   * @param {string} block - Content of a data or nested block (without outer braces).
   * @returns {Record<string, any>}
   */
  private extractJsdocFields(block: string): Record<string, any> {
    const result: Record<string, any> = {};
    const varStartRegex = /\/\*\*\s*([\s\S]*?)\s*\*\/\s*(\w+):\s*\{/g;
    const propRegex = /(\w+):\s*([^,\s{}]+)/g;

    let match;
    while ((match = varStartRegex.exec(block)) !== null) {
      // Strip the leading "*" that JSDoc puts at the start of each continuation line
      // before collapsing whitespace, otherwise multi-line descriptions keep stray
      // asterisks (e.g. "The `x` and * `y` properties ...").
      const description = match[1]
        .replace(/^[ \t]*\*[ \t]?/gm, "")
        .trim()
        .replace(/\s+/g, " ");
      const varName = match[2];

      const braceStart = match.index + match[0].length - 1;
      const braceEnd = this.findMatchingBrace(block, braceStart);
      if (braceEnd === -1) continue;

      // Advance past this variable's closing brace so the next exec() starts outside it,
      // preventing nested JSDoc entries from being matched again by the outer loop.
      varStartRegex.lastIndex = braceEnd + 1;
      const varContent = block.substring(braceStart + 1, braceEnd);

      const propsObj: Record<string, any> = {};
      let propMatch;
      propRegex.lastIndex = 0;
      while ((propMatch = propRegex.exec(varContent)) !== null) {
        propsObj[propMatch[1]] = propMatch[2];
      }

      result[varName] = { description, ...propsObj };

      // Flat merge by design: nested params are cached at the same level as top-level params
      // so they can be looked up directly by variable name if they appear as top-level columns.
      const nestedSearch = /\bnested:\s*\{/.exec(varContent);
      if (nestedSearch) {
        const nestedBraceStart = varContent.indexOf("{", nestedSearch.index);
        const nestedBraceEnd = this.findMatchingBrace(varContent, nestedBraceStart);
        if (nestedBraceEnd !== -1) {
          Object.assign(result, this.extractJsdocFields(varContent.substring(nestedBraceStart + 1, nestedBraceEnd)));
        }
      }
    }

    return result;
  }

  /**
   * Returns the index of the `}` that closes the `{` at `startIndex`, using brace counting.
   * Returns -1 if the source is unbalanced (no matching closing brace found).
   *
   * @private
   * @param {string} str - String to search.
   * @param {number} startIndex - Index of the opening `{`.
   * @returns {number}
   */
  private findMatchingBrace(str: string, startIndex: number): number {
    let depth = 0;
    for (let i = startIndex; i < str.length; i++) {
      if (str[i] === "{") depth++;
      else if (str[i] === "}" && --depth === 0) return i;
    }
    return -1;
  }
}
