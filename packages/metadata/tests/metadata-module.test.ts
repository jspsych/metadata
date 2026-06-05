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

// Note: JSON input is intentionally not tested here. When reading JSON, rows with a key absent
// entirely (rather than null/empty) never enter generateObservation for that key, so pre-registration
// doesn't fire for that row. This is pre-existing design tied to the non-rectangular JSON structure
// issue, which is tracked separately.
describe("variableMeasured completeness for CSV input", () => {
  let jsPsychMetadata: JsPsychMetadata;

  // Splits a CSV header row into column names. Assumes no quoted commas in headers — all test
  // data here is controlled and satisfies this constraint.
  function csvColumnNames(csv: string): string[] {
    return csv.split("\n")[0].split(",");
  }

  beforeEach(() => {
    jsPsychMetadata = new JsPsychMetadata();
  });

  // Baseline: the fix should not break the common case where all columns have values.
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

    // Also verify the always-empty column's description serializes correctly through getList()
    const emptyCol = variableMeasured.find((v) => v.name === "eye_tracking_status");
    expect(emptyCol.description).toBe("unknown");
  });

  test("sparse CSV: partially-empty columns resolve to a real type while always-empty columns stay unknown", async () => {
    // Simulates realistic jsPsych output where keyboard-response trials populate rt/stimulus and
    // survey trials populate question_order, each leaving the other columns empty. eye_tracking_status
    // is empty in every row. This exercises the pre-registration upgrade path: a column first seen with
    // an empty value is registered as value:"unknown", then upgraded to its real type once any later
    // row supplies a concrete value — but only for columns that are ever populated.
    const csv = [
      "trial_type,rt,response,stimulus,question_order,eye_tracking_status",
      "jsPsych-html-keyboard-response,450,f,<p>Hello</p>,,", // rt/stimulus set; question_order empty here
      "jsPsych-html-keyboard-response,512,j,<p>World</p>,,",
      "jsPsych-survey-likert,,4,,forward,", // rt/stimulus empty here; question_order set
      "jsPsych-survey-likert,,2,,reverse,",
    ].join("\n");

    await jsPsychMetadata.generate(csv, {}, "csv");

    const variableMeasured = jsPsychMetadata.getMetadata()["variableMeasured"] as any[];
    const outputNames = variableMeasured.map((v) => v.name);
    const byName = (name: string) => variableMeasured.find((v) => v.name === name);

    // Every header is still present regardless of sparsity.
    for (const col of csvColumnNames(csv)) {
      expect(outputNames).toContain(col);
    }

    // Columns empty in the *first* row they appear in must still upgrade to their real type once a
    // later row populates them — the "unknown" placeholder must not stick.
    expect(byName("question_order").value).toBe("string"); // populated only in the survey rows
    expect(byName("rt").value).toBe("number"); // populated only in the keyboard rows

    // A column with no value in any row keeps the placeholder.
    expect(byName("eye_tracking_status").value).toBe("unknown");
    expect(byName("eye_tracking_status").description).toBe("unknown");
  });
});

describe("JsPsychMetadata field operations", () => {
  let jsPsychMetadata: JsPsychMetadata;

  beforeEach(() => {
    jsPsychMetadata = new JsPsychMetadata();
  });

  test("#containsMetadataField returns true for a field set in the constructor", () => {
    expect(jsPsychMetadata.containsMetadataField("name")).toBe(true);
  });

  test("#containsMetadataField returns false for a field that was never set", () => {
    expect(jsPsychMetadata.containsMetadataField("nonexistent")).toBe(false);
  });

  test("#deleteMetadataField removes a field that was set", () => {
    jsPsychMetadata.setMetadataField("citations", 42);
    expect(jsPsychMetadata.containsMetadataField("citations")).toBe(true);
    jsPsychMetadata.deleteMetadataField("citations");
    expect(jsPsychMetadata.containsMetadataField("citations")).toBe(false);
  });

  test("#getUserMetadataFields returns user-set fields and excludes schema/type/author/variableMeasured", () => {
    jsPsychMetadata.setMetadataField("name", "My Study");
    jsPsychMetadata.setMetadataField("description", "A test study");

    const fields = jsPsychMetadata.getUserMetadataFields();

    expect(fields["name"]).toBe("My Study");
    expect(fields["description"]).toBe("A test study");
    expect(fields["schemaVersion"]).toBeUndefined();
    expect(fields["@type"]).toBeUndefined();
    expect(fields["@context"]).toBeUndefined();
    expect(fields["author"]).toBeUndefined();
    expect(fields["variableMeasured"]).toBeUndefined();
  });

  test("#containsVariable returns true for a default variable and false for one never set", () => {
    expect(jsPsychMetadata.containsVariable("trial_type")).toBe(true);
    expect(jsPsychMetadata.containsVariable("custom_col")).toBe(false);
    jsPsychMetadata.setVariable({ name: "custom_col", value: "string" });
    expect(jsPsychMetadata.containsVariable("custom_col")).toBe(true);
  });
});

describe("JsPsychMetadata#loadMetadata", () => {
  test("round-trips top-level metadata fields", () => {
    const source = new JsPsychMetadata();
    source.setMetadataField("name", "Flanker Study");
    source.setMetadataField("description", "A test of selective attention");

    const loaded = new JsPsychMetadata();
    loaded.loadMetadata(JSON.stringify(source.getMetadata()));

    expect(loaded.getMetadataField("name")).toBe("Flanker Study");
    expect(loaded.getMetadataField("description")).toBe("A test of selective attention");
  });

  test("round-trips authors", () => {
    const source = new JsPsychMetadata();
    source.setAuthor({ name: "Hannah", url: "https://example.com" });

    const loaded = new JsPsychMetadata();
    loaded.loadMetadata(JSON.stringify(source.getMetadata()));

    expect(loaded.getAuthor("Hannah")).toStrictEqual({ name: "Hannah", url: "https://example.com" });
  });

  test("round-trips variables", () => {
    const source = new JsPsychMetadata();
    source.setVariable({ name: "congruency", value: "string", description: "Congruent or incongruent trial" });

    const loaded = new JsPsychMetadata();
    loaded.loadMetadata(JSON.stringify(source.getMetadata()));

    expect(loaded.containsVariable("congruency")).toBe(true);
    expect(loaded.getVariable("congruency")).toMatchObject({ name: "congruency", description: "Congruent or incongruent trial" });
  });
});

describe("JsPsychMetadata#updateMetadata", () => {
  let jsPsychMetadata: JsPsychMetadata;

  beforeEach(() => {
    jsPsychMetadata = new JsPsychMetadata();
  });

  test("sets arbitrary top-level fields", async () => {
    await jsPsychMetadata.updateMetadata({ name: "My Study", description: "Updated" });
    expect(jsPsychMetadata.getMetadataField("name")).toBe("My Study");
    expect(jsPsychMetadata.getMetadataField("description")).toBe("Updated");
  });

  test("sets authors via the author key", async () => {
    await jsPsychMetadata.updateMetadata({ author: { researcher: { name: "Hannah", affiliation: "UW" } } });
    expect(jsPsychMetadata.getAuthor("Hannah")).toMatchObject({ name: "Hannah", affiliation: "UW" });
  });

  test("updates an existing variable's fields via the variables key", async () => {
    jsPsychMetadata.setVariable({ name: "correct", value: "string", description: "unknown" });

    await jsPsychMetadata.updateMetadata({ variables: { correct: { value: "boolean" } } });

    const variable = jsPsychMetadata.getVariable("correct") as any;
    expect(variable.value).toBe("boolean");
  });

  test("warns and skips when the variables key targets a variable that does not exist", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await jsPsychMetadata.updateMetadata({ variables: { nonexistent: { description: "ghost" } } });
      expect(warn).toHaveBeenCalledWith("Metadata does not contain variable:", "nonexistent");
    } finally {
      warn.mockRestore();
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
