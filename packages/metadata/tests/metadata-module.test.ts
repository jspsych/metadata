import JsPsychMetadata from "../src/index";

describe("always-empty columns in variableMeasured", () => {
  let jsPsychMetadata: JsPsychMetadata;

  beforeEach(() => {
    jsPsychMetadata = new JsPsychMetadata();
  });

  test("column with all empty values appears in variableMeasured with value:unknown", async () => {
    const csv = [
      "trial_type,rt,eye_tracking_status",
      "jsPsych-html-keyboard-response,450,",
      "jsPsych-html-keyboard-response,512,",
      "jsPsych-html-keyboard-response,389,",
    ].join("\n");

    await jsPsychMetadata.generate(csv, {}, "csv");

    const variableMeasured = jsPsychMetadata.getMetadata()["variableMeasured"] as any[];
    const names = variableMeasured.map((v) => v.name);

    expect(names).toContain("eye_tracking_status");

    const emptyCol = variableMeasured.find((v) => v.name === "eye_tracking_status");
    expect(emptyCol.value).toBe("unknown");
    expect(emptyCol.levels).toBeUndefined();
    expect(emptyCol.minValue).toBeUndefined();
    expect(emptyCol.maxValue).toBeUndefined();
  });

  test("column with only null string values appears in variableMeasured with value:unknown", async () => {
    const csv = [
      "trial_type,rt,score",
      "jsPsych-html-keyboard-response,450,null",
      "jsPsych-html-keyboard-response,512,null",
    ].join("\n");

    await jsPsychMetadata.generate(csv, {}, "csv");

    const variableMeasured = jsPsychMetadata.getMetadata()["variableMeasured"] as any[];
    const emptyCol = variableMeasured.find((v) => v.name === "score");

    expect(emptyCol).toBeDefined();
    expect(emptyCol.value).toBe("unknown");
    expect(emptyCol.levels).toBeUndefined();
  });

  test("column with some empty and some real values gets the correct type, not unknown", async () => {
    const csv = [
      "trial_type,rt,score",
      "jsPsych-html-keyboard-response,450,",
      "jsPsych-html-keyboard-response,512,8",
      "jsPsych-html-keyboard-response,389,",
    ].join("\n");

    await jsPsychMetadata.generate(csv, {}, "csv");

    const variableMeasured = jsPsychMetadata.getMetadata()["variableMeasured"] as any[];
    const partialCol = variableMeasured.find((v) => v.name === "score");

    expect(partialCol).toBeDefined();
    expect(partialCol.value).toBe("number");
    expect(partialCol.value).not.toBe("unknown");
  });

});

describe("variableMeasured completeness for CSV input", () => {
  let jsPsychMetadata: JsPsychMetadata;

  // Extracts every column name from a CSV header row
  function csvColumnNames(csv: string): string[] {
    return csv.split("\n")[0].split(",");
  }

  beforeEach(() => {
    jsPsychMetadata = new JsPsychMetadata();
  });

  test("all columns appear when every column has values in every row", async () => {
    const csv = [
      "trial_type,rt,response,stimulus",
      "jsPsych-html-keyboard-response,450,f,<p>Hello</p>",
      "jsPsych-html-keyboard-response,512,j,<p>World</p>",
      "jsPsych-html-keyboard-response,389,f,<p>Again</p>",
    ].join("\n");

    await jsPsychMetadata.generate(csv, {}, "csv");

    const variableMeasured = jsPsychMetadata.getMetadata()["variableMeasured"] as any[];
    const outputNames = variableMeasured.map((v) => v.name);

    for (const col of csvColumnNames(csv)) {
      expect(outputNames).toContain(col);
    }
  });

  test("all columns appear when one column is always empty", async () => {
    const csv = [
      "trial_type,rt,response,eye_tracking_status",
      "jsPsych-html-keyboard-response,450,f,",
      "jsPsych-html-keyboard-response,512,j,",
      "jsPsych-html-keyboard-response,389,f,",
    ].join("\n");

    await jsPsychMetadata.generate(csv, {}, "csv");

    const variableMeasured = jsPsychMetadata.getMetadata()["variableMeasured"] as any[];
    const outputNames = variableMeasured.map((v) => v.name);

    for (const col of csvColumnNames(csv)) {
      expect(outputNames).toContain(col);
    }
  });

  test("all columns appear when different trial types populate different columns (sparse CSV)", async () => {
    // Simulates realistic jsPsych output where keyboard-response trials have rt/response/stimulus
    // and survey trials have question_order but leave rt and stimulus empty
    const csv = [
      "trial_type,rt,response,stimulus,question_order",
      "jsPsych-html-keyboard-response,450,f,<p>Hello</p>,",
      "jsPsych-html-keyboard-response,512,j,<p>World</p>,",
      "jsPsych-survey-likert,,4,,forward",
      "jsPsych-survey-likert,,2,,reverse",
    ].join("\n");

    await jsPsychMetadata.generate(csv, {}, "csv");

    const variableMeasured = jsPsychMetadata.getMetadata()["variableMeasured"] as any[];
    const outputNames = variableMeasured.map((v) => v.name);

    for (const col of csvColumnNames(csv)) {
      expect(outputNames).toContain(col);
    }
  });
});

// missing displaying data modules tests
describe("JsPsychMetadata", () => {
  let jsPsychMetadata: JsPsychMetadata;

  beforeEach(() => {
    jsPsychMetadata = new JsPsychMetadata();
  });

  test("#setAndGetField", () => {
    // Set metadata fields
    jsPsychMetadata.setMetadataField("citations", 100);
    jsPsychMetadata.setMetadataField("colors", ["green", "yellow", "red"]);
    jsPsychMetadata.setMetadataField("description", "Updated description that says nothing"); // update

    // Check if fields are set correctly
    expect(jsPsychMetadata.getMetadataField("citations")).toBe(100);
    expect(jsPsychMetadata.getMetadataField("colors")).toStrictEqual(["green", "yellow", "red"]);
    expect(jsPsychMetadata.getMetadataField("description")).toBe(
      "Updated description that says nothing"
    );

    // Check if unset field returns undefined
    expect(jsPsychMetadata.getMetadataField("undefinedField")).toBeUndefined();
  });

  test("#setAndGetAuthor", () => {
    const author1 = {
      name: "John Cena",
    };
    jsPsychMetadata.setAuthor(author1);
    expect(jsPsychMetadata.getAuthor("John Cena")).toStrictEqual(author1["name"]);

    author1["type"] = "WWE Pro Wrestler";
    jsPsychMetadata.setAuthor(author1);
    expect(jsPsychMetadata.getAuthor("John Cena")).toStrictEqual(author1);
  });

  test("#setAndGetVariable", () => {
    const trialType = {
      "@type": "PropertyValue",
      name: "trial_type",
      description: "Plugin type that has been used to run trials",
      value: "string",
    };

    jsPsychMetadata.setVariable(trialType);
    expect(jsPsychMetadata.getVariable("trial_type")).toStrictEqual(trialType);
  });

  test("#deleteVariable", () => {
    const trialType = {
      "@type": "PropertyValue",
      name: "trial_type",
      description: "Plugin type that has been used to run trials",
      value: "string",
    };
    jsPsychMetadata.setVariable(trialType);

    jsPsychMetadata.deleteVariable("trial_type");
    expect(jsPsychMetadata.getVariableNames()).not.toContain("trial_type");
  });

  test("#updateVariable", () => {
    const trialType = {
      "@type": "PropertyValue",
      name: "trial_type",
      description: {
        default: "unknown",
        jsPsych: "The name of the plugin used to run the trial.",
      },
      value: "string",
    };

    jsPsychMetadata.updateVariable("trial_type", "levels", 100);
    trialType["levels"] = [100];
    expect(jsPsychMetadata.getVariable("trial_type")).toStrictEqual(trialType);
  });
});
