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
   * @returns {Promise<string|null>} The description of the plugin variable if found, otherwise null.
   * @throws Will throw an error if the fetch operation fails.
   */
  async getPluginInfo(pluginType: string, variableName: string, version, verbose, extension?) {
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

  private async generatePluginFields(pluginType: string, version, verbose, extension?) {
    const script = await this.fetchScript(pluginType, version, verbose, extension);

    // parses if they exist
    if (script !== undefined && script !== null && script !== ""){
      try {
        return this.parseJavadocString(script);
      } 
      catch (err) { // make this more descriptive
        console.warn("* Error parsing", pluginType);
        return {};
      }
    }
    else {
      return {}; // returns empty if can't fetch
    }
  }

  private generateUnpkg(pluginType, version, extension?){
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

  private async fetchScript(pluginType: string, version: string, verbose, extension?: boolean) {
    const unpkgUrl = this.generateUnpkg(pluginType, version, extension);

    if (verbose) console.log("-> fetching information for [", pluginType, "] from ->", unpkgUrl);

    try {
      const response = await fetch(unpkgUrl);
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

  // written with the help of chatgpt, try to parse javadoc and 
  private parseJavadocString(script: string) {
    const dataString = script.match(/data:\s*{([\s\S]*?)};\s*/).join();
    const result = {};
    // Regular expression to match each variable block
    const varRegex = /\/\*\*\s*([\s\S]*?)\s*\*\/\s*(\w+):\s*{\s*([\s\S]*?)\s*},?/gs;
    const propRegex = /\s*(\w+):\s*([^,\s]+)/g;

    // Match each variable block
    let match;
    while ((match = varRegex.exec(dataString)) !== null) {
      let [, description, varName, props] = match;
      description = description.trim().replace(/\s+/g, " "); // Clean up description

      const propsObj = {};
      let propMatch;
      while ((propMatch = propRegex.exec(props)) !== null) {
        let [, propName, propValue] = propMatch;
        propsObj[propName] = propValue;
      }

      result[varName] = {
        description: description,
        ...propsObj, // Add all additional properties to the result object
      };
    }

    return result;
  }
}
