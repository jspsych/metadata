import JsPsychMetadata from "../src/index";

// Regression for #70: a whitespace-only cell (e.g. a single space) must not be misdetected as
// numeric. Number(" ") === 0 passes the old isNaN(Number(value)) check, but parseFloat(" ") is NaN,
// which leaked through as NaN min/max (serialized to null) on otherwise-categorical string columns.
describe("whitespace-only values are not treated as numeric (#70)", () => {
  let jsPsychMetadata: JsPsychMetadata;

  beforeEach(() => {
    jsPsychMetadata = new JsPsychMetadata();
  });

  test("a string column with a whitespace-only cell stays categorical with no NaN/null min/max", async () => {
    const csv = [
      "trial_type,response",
      "html-keyboard-response,Enter",
      "html-keyboard-response, ", // single-space response
      "html-keyboard-response,p",
    ].join("\n");

    await jsPsychMetadata.generate(csv, {}, "csv");

    const variableMeasured = jsPsychMetadata.getMetadata()["variableMeasured"] as any[];
    const response = variableMeasured.find((v) => v.name === "response");

    expect(response.value).toBe("string");
    expect(response).not.toHaveProperty("minValue");
    expect(response).not.toHaveProperty("maxValue");
    // The whitespace cell is recorded as a level, not silently turned into a NaN number.
    expect(response.levels).toEqual(expect.arrayContaining(["Enter", "p", " "]));
  });

  test("genuinely numeric string columns are still coerced to numbers", async () => {
    const csv = [
      "trial_type,rt",
      "html-keyboard-response,450",
      "html-keyboard-response,512",
    ].join("\n");

    await jsPsychMetadata.generate(csv, {}, "csv");

    const rt = (jsPsychMetadata.getMetadata()["variableMeasured"] as any[]).find((v) => v.name === "rt");
    expect(rt.value).toBe("number");
    expect(rt.minValue).toBe(450);
    expect(rt.maxValue).toBe(512);
    expect(rt).not.toHaveProperty("levels");
  });
});

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

  test("#containsVariable returns true for a set variable and false for one never set", () => {
    // System variables are no longer seeded at construction; they appear only once observed in
    // the data (covered by the lazy-registration regression test below).
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

    // trial_type is no longer seeded at construction, so register it first (a fresh copy, so the
    // stored object isn't the same reference as the `trialType` we compare against).
    jsPsychMetadata.setVariable({
      "@type": "PropertyValue",
      name: "trial_type",
      description: {
        default: "unknown",
        jsPsych: "The name of the plugin used to run the trial.",
      },
      value: "string",
    });
    jsPsychMetadata.updateVariable("trial_type", "levels", 100);
    trialType["levels"] = [100];
    expect(jsPsychMetadata.getVariable("trial_type")).toStrictEqual(trialType);
  });

  test("#getAuthorList returns empty array when no authors have been added", () => {
    expect(jsPsychMetadata.getAuthorList()).toStrictEqual([]);
  });

  test("#getAuthorList returns all added authors", () => {
    jsPsychMetadata.setAuthor({ name: "Alice" });
    jsPsychMetadata.setAuthor({ name: "Bob", affiliation: "UW" });

    const list = jsPsychMetadata.getAuthorList();
    expect(list).toHaveLength(2);
    expect(list).toContainEqual("Alice");
    expect(list).toContainEqual({ name: "Bob", affiliation: "UW" });
  });

  test("#deleteAuthor removes the named author and leaves others intact", () => {
    jsPsychMetadata.setAuthor({ name: "Alice" });
    jsPsychMetadata.setAuthor({ name: "Bob" });

    jsPsychMetadata.deleteAuthor("Alice");

    const list = jsPsychMetadata.getAuthorList();
    expect(list).toHaveLength(1);
    expect(list).toContainEqual("Bob");
    expect(list.some((a) => a === "Alice" || (typeof a === "object" && a.name === "Alice"))).toBe(false);
  });

  test("#getVariableNames returns the names of all current variables", () => {
    // No system variables are seeded at construction, so a fresh instance has none.
    expect(jsPsychMetadata.getVariableNames()).toEqual([]);

    jsPsychMetadata.setVariable({ name: "custom_score", value: "number" });
    expect(jsPsychMetadata.getVariableNames()).toContain("custom_score");

    jsPsychMetadata.deleteVariable("custom_score");
    expect(jsPsychMetadata.getVariableNames()).not.toContain("custom_score");
  });

  test("#getVariableList returns all variable objects", () => {
    // No system variables are seeded at construction, so a fresh instance has none.
    expect(jsPsychMetadata.getVariableList()).toEqual([]);

    jsPsychMetadata.setVariable({ name: "rt", value: "number", description: "Reaction time in ms" });
    const updated = jsPsychMetadata.getVariableList();
    expect(updated.some((v: any) => v.name === "rt" && v.value === "number")).toBe(true);
  });
});

// Regression for #109: jsPsych system variables (trial_type/trial_index/time_elapsed/extension_*)
// used to be seeded into variableMeasured unconditionally, so a dataset whose CSVs lacked one —
// e.g. a processed export without time_elapsed — produced an orphan variableMeasured entry that
// fails Psych-DS validation (VARIABLE_MISSING_FROM_CSV_COLUMNS). They now register lazily, only
// when the column is actually observed.
describe("system variables register lazily (#109)", () => {
  const mockFetch = jest.fn().mockResolvedValue({ text: () => Promise.resolve("") });
  beforeEach(() => {
    (global as any).fetch = mockFetch;
    mockFetch.mockClear();
  });

  test("time_elapsed is omitted when the data has no such column, and every variable maps to a CSV column", async () => {
    const csv = [
      "trial_type,trial_index,response",
      "html-keyboard-response,0,f",
      "html-keyboard-response,1,j",
    ].join("\n");

    const meta = new JsPsychMetadata();
    await meta.generate(csv, {}, "csv");

    const names = (meta.getMetadata()["variableMeasured"] as any[]).map((v) => v.name);
    // Present system columns are still declared (with their jsPsych descriptions)…
    expect(names).toContain("trial_type");
    expect(names).toContain("trial_index");
    expect(names).toContain("response");
    // …but the absent system column does not appear.
    expect(names).not.toContain("time_elapsed");

    // Validation invariant: every declared variable corresponds to an actual CSV column.
    const csvColumns = new Set(csv.split("\n")[0].split(","));
    for (const name of names) expect(csvColumns.has(name)).toBe(true);
  });

  test("time_elapsed is included when the data does contain it", async () => {
    const csv = [
      "trial_type,trial_index,time_elapsed",
      "html-keyboard-response,0,100",
      "html-keyboard-response,1,250",
    ].join("\n");

    const meta = new JsPsychMetadata();
    await meta.generate(csv, {}, "csv");

    const names = (meta.getMetadata()["variableMeasured"] as any[]).map((v) => v.name);
    expect(names).toContain("time_elapsed");
  });

  // extension_type / extension_version share the orphan-seeding hazard: an eager
  // generateDefaultExtensionVariables() call used to register BOTH whenever extension_type was
  // present, so a dataset with extension_type but no extension_version column got an orphan
  // extension_version entry. They now register lazily per-column like the other system variables.
  test("extension_version is omitted when only extension_type is present", async () => {
    const csv = [
      "trial_type,trial_index,extension_type",
      "html-keyboard-response,0,mock-extension",
      "html-keyboard-response,1,mock-extension",
    ].join("\n");

    const meta = new JsPsychMetadata();
    await meta.generate(csv, {}, "csv");

    const names = (meta.getMetadata()["variableMeasured"] as any[]).map((v) => v.name);
    expect(names).toContain("extension_type");
    expect(names).not.toContain("extension_version");

    const csvColumns = new Set(csv.split("\n")[0].split(","));
    for (const name of names) expect(csvColumns.has(name)).toBe(true);
  });

  test("both extension variables are included when both columns are present", async () => {
    const csv = [
      "trial_type,trial_index,extension_type,extension_version",
      "html-keyboard-response,0,mock-extension,1.0.0",
      "html-keyboard-response,1,mock-extension,1.0.0",
    ].join("\n");

    const meta = new JsPsychMetadata();
    await meta.generate(csv, {}, "csv");

    const names = (meta.getMetadata()["variableMeasured"] as any[]).map((v) => v.name);
    expect(names).toContain("extension_type");
    expect(names).toContain("extension_version");
  });
});

describe("mixed-type column handling (#71)", () => {
  let jsPsychMetadata: JsPsychMetadata;

  beforeEach(() => {
    jsPsychMetadata = new JsPsychMetadata();
  });

  test("numbers-then-string: column is categorical with no min/max and value:string", async () => {
    // Repro from the issue: block_number has numeric rows 1–4 and a string "Practice".
    const csv = [
      "trial_type,block_number",
      "html-keyboard-response,1",
      "html-keyboard-response,Practice",
      "html-keyboard-response,2",
      "html-keyboard-response,3",
    ].join("\n");

    await jsPsychMetadata.generate(csv, {}, "csv");

    const variableMeasured = jsPsychMetadata.getMetadata()["variableMeasured"] as any[];
    const col = variableMeasured.find((v) => v.name === "block_number");

    expect(col).toBeDefined();
    expect(col.value).toBe("string");
    expect(col.levels).toContain("Practice");
    expect(col.levels).toContain("1");
    expect(col.levels).toContain("2");
    expect(col.levels).toContain("3");
    expect(col.minValue).toBeUndefined();
    expect(col.maxValue).toBeUndefined();
  });

  test("string-then-numbers: column is categorical with no min/max", async () => {
    const csv = [
      "trial_type,block_number",
      "html-keyboard-response,Practice",
      "html-keyboard-response,1",
      "html-keyboard-response,2",
    ].join("\n");

    await jsPsychMetadata.generate(csv, {}, "csv");

    const variableMeasured = jsPsychMetadata.getMetadata()["variableMeasured"] as any[];
    const col = variableMeasured.find((v) => v.name === "block_number");

    expect(col).toBeDefined();
    expect(col.value).toBe("string");
    expect(col.levels).toContain("Practice");
    expect(col.levels).toContain("1");
    expect(col.levels).toContain("2");
    expect(col.minValue).toBeUndefined();
    expect(col.maxValue).toBeUndefined();
  });

  test("purely numeric column is unaffected: still has min/max and no levels", async () => {
    const csv = [
      "trial_type,rt",
      "html-keyboard-response,450",
      "html-keyboard-response,512",
      "html-keyboard-response,389",
    ].join("\n");

    await jsPsychMetadata.generate(csv, {}, "csv");

    const variableMeasured = jsPsychMetadata.getMetadata()["variableMeasured"] as any[];
    const col = variableMeasured.find((v) => v.name === "rt");

    expect(col).toBeDefined();
    expect(col.value).toBe("number");
    expect(col.minValue).toBe(389);
    expect(col.maxValue).toBe(512);
    expect(col.levels).toBeUndefined();
  });

  test("purely string column is unaffected: still has levels and no min/max", async () => {
    const csv = [
      "trial_type,response",
      "html-keyboard-response,f",
      "html-keyboard-response,j",
      "html-keyboard-response,f",
    ].join("\n");

    await jsPsychMetadata.generate(csv, {}, "csv");

    const variableMeasured = jsPsychMetadata.getMetadata()["variableMeasured"] as any[];
    const col = variableMeasured.find((v) => v.name === "response");

    expect(col).toBeDefined();
    expect(col.value).toBe("string");
    expect(col.levels).toContain("f");
    expect(col.levels).toContain("j");
    expect(col.minValue).toBeUndefined();
    expect(col.maxValue).toBeUndefined();
  });

  test("mixed-type warning is emitted exactly once per column", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const csv = [
      "trial_type,block_number",
      "html-keyboard-response,1",
      "html-keyboard-response,Practice",
      "html-keyboard-response,2",
      "html-keyboard-response,Test",
    ].join("\n");

    await jsPsychMetadata.generate(csv, {}, "csv");

    const mixedWarnings = warnSpy.mock.calls.filter((args) =>
      typeof args[0] === "string" && args[0].includes("mixed numeric and non-numeric")
    );
    expect(mixedWarnings).toHaveLength(1);

    warnSpy.mockRestore();
  });

  test("intermediate numeric values between min and max are not preserved as levels", async () => {
    // Known limitation: only the min and max of the numeric-only prefix are recoverable as
    // string levels. Values between them (e.g. "3" below) are silently dropped.
    // This test documents that behavior so a future change can't accidentally alter it without notice.
    const csv = [
      "trial_type,score",
      "html-keyboard-response,1",
      "html-keyboard-response,3",
      "html-keyboard-response,5",
      "html-keyboard-response,Practice",
    ].join("\n");

    await jsPsychMetadata.generate(csv, {}, "csv");

    const variableMeasured = jsPsychMetadata.getMetadata()["variableMeasured"] as any[];
    const col = variableMeasured.find((v) => v.name === "score");

    expect(col.value).toBe("string");
    expect(col.levels).toContain("1");  // min preserved
    expect(col.levels).toContain("5");  // max preserved
    expect(col.levels).toContain("Practice");
    expect(col.levels).not.toContain("3");  // intermediate value is lost — known limitation
    expect(col.minValue).toBeUndefined();
    expect(col.maxValue).toBeUndefined();
  });

  test("second generate() call on the same instance: mixed column still converts correctly", async () => {
    // generate() accumulates state, so mixedColumns is intentionally not reset between calls.
    // A mixed column from the first call retains its "string" type; numeric values in the
    // second call continue to be added as string levels (not min/max).
    const csv1 = [
      "trial_type,block_number",
      "html-keyboard-response,1",
      "html-keyboard-response,Practice",
    ].join("\n");
    const csv2 = [
      "trial_type,block_number",
      "html-keyboard-response,2",
      "html-keyboard-response,Bonus",
    ].join("\n");

    await jsPsychMetadata.generate(csv1, {}, "csv");
    await jsPsychMetadata.generate(csv2, {}, "csv");

    const variableMeasured = jsPsychMetadata.getMetadata()["variableMeasured"] as any[];
    const col = variableMeasured.find((v) => v.name === "block_number");

    expect(col.value).toBe("string");
    expect(col.levels).toContain("Practice");
    expect(col.levels).toContain("Bonus");
    expect(col.levels).toContain("2");  // numeric from second call added as string level
    expect(col.minValue).toBeUndefined();
    expect(col.maxValue).toBeUndefined();
  });
});

describe("boolean vs string true/false levels", () => {
  let jsPsychMetadata: JsPsychMetadata;

  beforeEach(() => {
    jsPsychMetadata = new JsPsychMetadata();
  });

  const col = (m: JsPsychMetadata, name: string) =>
    (m.getMetadata()["variableMeasured"] as any[]).find((v) => v.name === name);

  test("genuine boolean values get value:boolean and NO levels", async () => {
    // JSON data carries real booleans (typeof === "boolean").
    const data = JSON.stringify([
      { trial_type: "html-keyboard-response", correct: true },
      { trial_type: "html-keyboard-response", correct: false },
    ]);

    await jsPsychMetadata.generate(data);

    const c = col(jsPsychMetadata, "correct");
    expect(c).toBeDefined();
    expect(c.value).toBe("boolean");
    expect(c.levels).toBeUndefined();
    expect(c.minValue).toBeUndefined();
    expect(c.maxValue).toBeUndefined();
  });

  test('string "true"/"false" stay string and surface as levels (both values)', async () => {
    // CSV cells are strings; "true"/"false" are not coerced to boolean, so they accumulate
    // as levels — and both values are captured (regression for the missing-"true" / [false] bug).
    const csv = [
      "trial_type,flag",
      "html-keyboard-response,true",
      "html-keyboard-response,false",
      "html-keyboard-response,true",
    ].join("\n");

    await jsPsychMetadata.generate(csv, {}, "csv");

    const c = col(jsPsychMetadata, "flag");
    expect(c).toBeDefined();
    expect(c.value).toBe("string");
    expect(new Set(c.levels)).toEqual(new Set(["true", "false"]));
  });

  test("manual value:boolean override drops detected levels", async () => {
    const csv = ["trial_type,flag", "t,true", "t,false"].join("\n");
    await jsPsychMetadata.generate(csv, {}, "csv");
    expect(col(jsPsychMetadata, "flag").levels).toBeDefined();

    await jsPsychMetadata.updateMetadata({ variables: { flag: { value: "boolean" } } });

    const c = col(jsPsychMetadata, "flag");
    expect(c.value).toBe("boolean");
    expect(c.levels).toBeUndefined();
  });

  test("manual value:boolean override warns when data isn't boolean-like", async () => {
    const csv = ["trial_type,block", "t,Practice", "t,Bonus"].join("\n");
    await jsPsychMetadata.generate(csv, {}, "csv");

    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await jsPsychMetadata.updateMetadata({ variables: { block: { value: "boolean" } } });
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Variable "block"'));
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Practice"));
    } finally {
      warn.mockRestore();
    }
  });

  test("manual value:boolean override does NOT warn for true/false/0/1 data", async () => {
    const csv = ["trial_type,flag", "t,1", "t,0"].join("\n");
    await jsPsychMetadata.generate(csv, {}, "csv");

    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await jsPsychMetadata.updateMetadata({ variables: { flag: { value: "boolean" } } });
      const booleanWarnings = warn.mock.calls.filter((c) => String(c[0]).includes('value:"boolean"'));
      expect(booleanWarnings).toHaveLength(0);
    } finally {
      warn.mockRestore();
    }
  });
});
