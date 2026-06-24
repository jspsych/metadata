import JsPsychMetadata from "../src/index";
import { analyzeJoinKeys } from "../src/utils";

const MOCK_PLUGIN_SOURCE = `
  const info = {
    data: {
      /** The participant's response */
      response: {
        type: ParameterType.OBJECT,
      },
      /** Reaction time in milliseconds */
      rt: {
        type: ParameterType.INT,
      },
      /** Mouse tracking data */
      mouse_tracking_data: {
        type: ParameterType.OBJECT,
      },
    };
  }
`;

const mockFetch = jest.fn().mockResolvedValue({
  text: () => Promise.resolve(MOCK_PLUGIN_SOURCE),
});

const BASE = { trial_type: "mock-plugin", trial_index: 0, time_elapsed: 100 };

describe("Nested JSON column handling", () => {
  beforeEach(() => {
    (global as any).fetch = mockFetch;
    mockFetch.mockClear();
  });

  // ─── Case 1: flat JSON objects ───────────────────────────────────────────────

  describe("flat JSON object columns", () => {
    test("JSON input: sub-variables are registered with dotted names", async () => {
      const data = JSON.stringify([
        { ...BASE, response: { Q0: 4, Q1: 3 } },
      ]);
      const meta = new JsPsychMetadata();
      await meta.generate(data);

      expect(meta.getVariableNames()).toContain("response.Q0");
      expect(meta.getVariableNames()).toContain("response.Q1");
    });

    test("CSV input: JSON object string is detected and expanded", async () => {
      const csv = [
        "trial_type,trial_index,time_elapsed,response",
        'mock-plugin,0,100,"{""Q0"":4,""Q1"":3}"',
      ].join("\n");
      const meta = new JsPsychMetadata();
      await meta.generate(csv, {}, "csv");

      expect(meta.getVariableNames()).toContain("response.Q0");
      expect(meta.getVariableNames()).toContain("response.Q1");
    });

    test("parent variable is registered with value: 'object' and no levels", async () => {
      const data = JSON.stringify([
        { ...BASE, response: { Q0: 4, Q1: 3 } },
      ]);
      const meta = new JsPsychMetadata();
      await meta.generate(data);

      expect(meta.getVariableNames()).toContain("response");
      const parent = meta.getVariable("response") as any;
      expect(parent.value).toBe("object");
      expect(parent.levels).toBeUndefined();
    });

    test("numeric sub-fields get minValue and maxValue tracked", async () => {
      const data = JSON.stringify([
        { ...BASE, response: { rt: 300 } },
        { ...BASE, trial_index: 1, time_elapsed: 200, response: { rt: 700 } },
      ]);
      const meta = new JsPsychMetadata();
      await meta.generate(data);

      const v = meta.getVariable("response.rt") as any;
      expect(v.value).toBe("number");
      expect(v.minValue).toBe(300);
      expect(v.maxValue).toBe(700);
    });

    test("null rows do not prevent sub-variables from being registered from other rows", async () => {
      const data = JSON.stringify([
        { ...BASE, response: null },
        { ...BASE, trial_index: 1, time_elapsed: 200, response: { Q0: 1 } },
      ]);
      const meta = new JsPsychMetadata();
      await meta.generate(data);

      expect(meta.getVariableNames()).toContain("response.Q0");
    });

    test("plain string column is unchanged — still accumulates levels", async () => {
      const data = JSON.stringify([
        { ...BASE, response: "yes" },
        { ...BASE, trial_index: 1, time_elapsed: 200, response: "no" },
      ]);
      const meta = new JsPsychMetadata();
      await meta.generate(data);

      const v = meta.getVariable("response") as any;
      expect(v.value).toBe("string");
      expect(v.levels).toContain("yes");
      expect(v.levels).toContain("no");
    });
  });

  // ─── Case 1b: deeply nested JSON objects (>2 levels) ─────────────────────────

  describe("deeply nested JSON object columns", () => {
    test("objects more than one level deep are fully expanded with dotted names", async () => {
      const data = JSON.stringify([
        { ...BASE, response: { Q0: { score: 4, meta: { valid: true } } } },
      ]);
      const meta = new JsPsychMetadata();
      await meta.generate(data);

      const names = meta.getVariableNames();
      expect(names).toContain("response.Q0.score");
      expect(names).toContain("response.Q0.meta.valid");
    });

    test("intermediate object nodes are registered with value: 'object' and no levels", async () => {
      const data = JSON.stringify([
        { ...BASE, response: { Q0: { score: 4, meta: { valid: true } } } },
      ]);
      const meta = new JsPsychMetadata();
      await meta.generate(data);

      for (const node of ["response", "response.Q0", "response.Q0.meta"]) {
        const v = meta.getVariable(node) as any;
        expect(v.value).toBe("object");
        expect(v.levels).toBeUndefined();
      }
    });

    test("deep numeric leaves still track minValue and maxValue", async () => {
      const data = JSON.stringify([
        { ...BASE, response: { Q0: { score: 2 } } },
        { ...BASE, trial_index: 1, time_elapsed: 200, response: { Q0: { score: 9 } } },
      ]);
      const meta = new JsPsychMetadata();
      await meta.generate(data);

      const v = meta.getVariable("response.Q0.score") as any;
      expect(v.value).toBe("number");
      expect(v.minValue).toBe(2);
      expect(v.maxValue).toBe(9);
    });

    test("deep string leaves still accumulate levels", async () => {
      const data = JSON.stringify([
        { ...BASE, response: { Q0: { label: "yes" } } },
        { ...BASE, trial_index: 1, time_elapsed: 200, response: { Q0: { label: "no" } } },
      ]);
      const meta = new JsPsychMetadata();
      await meta.generate(data);

      const v = meta.getVariable("response.Q0.label") as any;
      expect(v.value).toBe("string");
      expect(v.levels).toContain("yes");
      expect(v.levels).toContain("no");
    });

    test("arrays nested inside objects are typed as 'array', not 'object'", async () => {
      const data = JSON.stringify([
        { ...BASE, response: { Q0: { points: [1, 2, 3] } } },
      ]);
      const meta = new JsPsychMetadata();
      await meta.generate(data);

      const v = meta.getVariable("response.Q0.points") as any;
      expect(v.value).toBe("array");
      expect(v.levels).toBeUndefined();
    });

    test("nested arrays-of-objects are extracted to a CSV keyed by their dotted name", async () => {
      const data = JSON.stringify([
        { ...BASE, response: { samples: [{ x: 1, y: 2 }, { x: 3, y: 4 }] } },
      ]);
      const meta = new JsPsychMetadata();
      await meta.generate(data);

      const extracted = meta.getExtractedArrays();
      expect(extracted.has("response.samples")).toBe(true);
      const rows = extracted.get("response.samples")!;
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ trial_index: 0, element_index: 0, "response.samples.x": 1, "response.samples.y": 2 });
      expect(rows[1]).toMatchObject({ trial_index: 0, element_index: 1, "response.samples.x": 3, "response.samples.y": 4 });
    });

    test("nested arrays of primitives are extracted under a synthetic .value column", async () => {
      const data = JSON.stringify([
        { ...BASE, response: { Q0: { points: [1, 2, 3] } } },
      ]);
      const meta = new JsPsychMetadata();
      await meta.generate(data);

      expect((meta.getVariable("response.Q0.points") as any).value).toBe("array"); // parent stays array
      const rows = meta.getExtractedArrays().get("response.Q0.points")!;
      expect(rows).toHaveLength(3);
      expect(rows[0]).toMatchObject({ trial_index: 0, element_index: 0, "response.Q0.points.value": 1 });
      expect(rows[2]).toMatchObject({ element_index: 2, "response.Q0.points.value": 3 });
      expect((meta.getVariable("response.Q0.points.value") as any).value).toBe("number");
    });

    test("CSV input: deeply nested JSON object string is detected and expanded", async () => {
      const csv = [
        "trial_type,trial_index,time_elapsed,response",
        'mock-plugin,0,100,"{""Q0"":{""score"":4,""meta"":{""valid"":true}}}"',
      ].join("\n");
      const meta = new JsPsychMetadata();
      await meta.generate(csv, {}, "csv");

      const names = meta.getVariableNames();
      expect(names).toContain("response.Q0.score");
      expect(names).toContain("response.Q0.meta.valid");
    });
  });

  // ─── Case 2: JSON arrays of objects ─────────────────────────────────────────

  describe("JSON array-of-objects columns", () => {
    test("parent variable is registered with value: 'array' and no levels", async () => {
      const data = JSON.stringify([
        { ...BASE, mouse_tracking_data: [{ x: 120, y: 340, t: 0 }, { x: 121, y: 338, t: 16 }] },
      ]);
      const meta = new JsPsychMetadata();
      await meta.generate(data);

      expect(meta.getVariableNames()).toContain("mouse_tracking_data");
      const v = meta.getVariable("mouse_tracking_data") as any;
      expect(v.value).toBe("array");
      expect(v.levels).toBeUndefined();
    });

    test("getExtractedArrays returns rows with trial_index and element_index", async () => {
      const data = JSON.stringify([
        { ...BASE, trial_index: 3, mouse_tracking_data: [{ x: 120, y: 340, t: 0 }, { x: 121, y: 338, t: 16 }] },
      ]);
      const meta = new JsPsychMetadata();
      await meta.generate(data);

      const arrays = meta.getExtractedArrays();
      expect(arrays.has("mouse_tracking_data")).toBe(true);

      const rows = arrays.get("mouse_tracking_data")!;
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ trial_index: 3, element_index: 0, "mouse_tracking_data.x": 120, "mouse_tracking_data.y": 340, "mouse_tracking_data.t": 0 });
      expect(rows[1]).toMatchObject({ trial_index: 3, element_index: 1, "mouse_tracking_data.x": 121, "mouse_tracking_data.y": 338, "mouse_tracking_data.t": 16 });
    });

    test("null elements within an array are skipped without error", async () => {
      const data = JSON.stringify([
        { ...BASE, mouse_tracking_data: [{ x: 1 }, null, { x: 2 }] },
      ]);
      const meta = new JsPsychMetadata();
      await meta.generate(data);

      const rows = meta.getExtractedArrays().get("mouse_tracking_data")!;
      expect(rows).toHaveLength(2);
      expect(rows[0]["mouse_tracking_data.x"]).toBe(1);
      expect(rows[1]["mouse_tracking_data.x"]).toBe(2);
    });

    test("primitive array is extracted to a sidecar under a synthetic .value column (with min/max)", async () => {
      const data = JSON.stringify([
        { ...BASE, scores: [1, 2, 3] },
      ]);
      const meta = new JsPsychMetadata();
      await meta.generate(data);

      expect((meta.getVariable("scores") as any).value).toBe("array"); // parent column stays an array
      const rows = meta.getExtractedArrays().get("scores")!;
      expect(rows).toHaveLength(3);
      expect(rows[0]).toMatchObject({ trial_index: 0, element_index: 0, "scores.value": 1 });
      const v = meta.getVariable("scores.value") as any;
      expect(v.value).toBe("number");
      expect(v.minValue).toBe(1);
      expect(v.maxValue).toBe(3);
    });

    test("rows from multiple trials are all accumulated under the same column key", async () => {
      const data = JSON.stringify([
        { ...BASE, trial_index: 0, mouse_tracking_data: [{ x: 1 }] },
        { ...BASE, trial_index: 1, time_elapsed: 200, mouse_tracking_data: [{ x: 2 }, { x: 3 }] },
      ]);
      const meta = new JsPsychMetadata();
      await meta.generate(data);

      const rows = meta.getExtractedArrays().get("mouse_tracking_data")!;
      expect(rows).toHaveLength(3);
      expect(rows[0]).toMatchObject({ trial_index: 0, element_index: 0, "mouse_tracking_data.x": 1 });
      expect(rows[1]).toMatchObject({ trial_index: 1, element_index: 0, "mouse_tracking_data.x": 2 });
      expect(rows[2]).toMatchObject({ trial_index: 1, element_index: 1, "mouse_tracking_data.x": 3 });
    });

    test("second generate() call resets extracted arrays — rows from first call are not retained", async () => {
      const data1 = JSON.stringify([
        { ...BASE, trial_index: 0, mouse_tracking_data: [{ x: 1 }, { x: 2 }] },
      ]);
      const data2 = JSON.stringify([
        { ...BASE, trial_index: 0, mouse_tracking_data: [{ x: 99 }] },
      ]);
      const meta = new JsPsychMetadata();
      await meta.generate(data1);
      await meta.generate(data2);

      const rows = meta.getExtractedArrays().get("mouse_tracking_data")!;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ trial_index: 0, element_index: 0, "mouse_tracking_data.x": 99 });
    });
  });

  // ─── Extension description handling ─────────────────────────────────────────

  describe("extension descriptions for nested columns", () => {
    const EXT_BASE = {
      trial_type: "mock-plugin",
      trial_index: 0,
      time_elapsed: 100,
      extension_type: ["mock-extension"],
      extension_version: ["1.0.0"],
    };

    // When the plugin and extension return the same description text, updateDescription
    // merges them under a combined key ("mock-plugin, mock-extension"). Either way,
    // the key contains "mock-extension", confirming the extension fetch ran.
    const hasExtensionKey = (description: any) =>
      typeof description === "object" &&
      Object.keys(description).some((k) => k.includes("mock-extension"));

    test("array-valued column gets extension description alongside plugin description", async () => {
      const data = JSON.stringify([
        { ...EXT_BASE, mouse_tracking_data: [{ x: 1, y: 2 }] },
      ]);
      const meta = new JsPsychMetadata();
      await meta.generate(data);

      expect(hasExtensionKey(meta.getVariable("mouse_tracking_data")["description"])).toBe(true);
    });

    test("object-valued column gets extension description alongside plugin description", async () => {
      const data = JSON.stringify([
        { ...EXT_BASE, response: { Q0: 4, Q1: 3 } },
      ]);
      const meta = new JsPsychMetadata();
      await meta.generate(data);

      expect(hasExtensionKey(meta.getVariable("response")["description"])).toBe(true);
    });

    test("string-valued column still gets extension description (regression guard)", async () => {
      const data = JSON.stringify([
        { ...EXT_BASE, response: "yes" },
      ]);
      const meta = new JsPsychMetadata();
      await meta.generate(data);

      expect(hasExtensionKey(meta.getVariable("response")["description"])).toBe(true);
    });
  });
});

// ─── analyzeJoinKeys unit tests ───────────────────────────────────────────────

describe("analyzeJoinKeys", () => {
  const rows = [
    { trial_type: "p", trial_index: 0, time_elapsed: 100, subject_id: "s1", session: "a", condition: "x" },
    { trial_type: "p", trial_index: 1, time_elapsed: 200, subject_id: "s1", session: "a", condition: "x" },
    { trial_type: "p", trial_index: 0, time_elapsed: 100, subject_id: "s2", session: "b", condition: "x" },
    { trial_type: "p", trial_index: 1, time_elapsed: 200, subject_id: "s2", session: "b", condition: "x" },
  ];

  test("returns isUnique: true when keys are already unique", () => {
    const result = analyzeJoinKeys(rows, ["subject_id", "trial_index"]);
    expect(result.isUnique).toBe(true);
    expect(result.duplicateCount).toBe(0);
    expect(result.suggestedAdditionalKeys).toBeNull();
  });

  test("returns isUnique: false with correct duplicateCount when trial_index alone repeats", () => {
    const result = analyzeJoinKeys(rows, ["trial_index"]);
    expect(result.isUnique).toBe(false);
    expect(result.duplicateCount).toBe(2); // trial_index 0 and 1 each appear twice
  });

  test("duplicateValues contains example key maps for duplicate rows", () => {
    const result = analyzeJoinKeys(rows, ["trial_index"]);
    expect(result.duplicateValues.length).toBeGreaterThan(0);
    expect(result.duplicateValues[0]).toHaveProperty("trial_index");
  });

  test("excludes system columns (trial_type, time_elapsed, etc.) from candidates", () => {
    const result = analyzeJoinKeys(rows, ["trial_index"]);
    const cols = result.candidates.map(c => c.column);
    expect(cols).not.toContain("trial_type");
    expect(cols).not.toContain("time_elapsed");
    expect(cols).not.toContain("extension_type");
  });

  test("excludes already-selected keys from candidates", () => {
    const result = analyzeJoinKeys(rows, ["trial_index"]);
    const cols = result.candidates.map(c => c.column);
    expect(cols).not.toContain("trial_index");
  });

  test("excludes unnamed/whitespace-only-header columns from candidates (#117)", () => {
    // R's write.csv prepends an unnamed row-index column (empty-string header). It's unique, so a
    // greedy resolver would happily pick it — but stripUnnamedColumns (#114) drops it from the
    // written output, so it must never be proposed as a join key (interactively or headless).
    const withRowIndex = [
      { "": "1", "  ": "a", trial_index: 0, subject_id: "s1" },
      { "": "2", "  ": "b", trial_index: 1, subject_id: "s1" },
      { "": "3", "  ": "c", trial_index: 0, subject_id: "s2" },
      { "": "4", "  ": "d", trial_index: 1, subject_id: "s2" },
    ];
    const result = analyzeJoinKeys(withRowIndex, ["trial_index"]);
    const cols = result.candidates.map(c => c.column);
    expect(cols).not.toContain("");      // empty header
    expect(cols).not.toContain("  ");    // whitespace-only header
    expect(cols).toContain("subject_id"); // the legitimate key is still offered
    // and an unnamed column is never smuggled into a greedy combination either
    expect(result.suggestedAdditionalKeys ?? []).not.toContain("");
    expect(result.suggestedAdditionalKeys ?? []).not.toContain("  ");
  });

  test("marks subject_id as makesUnique: true (it alone resolves all duplicates)", () => {
    const result = analyzeJoinKeys(rows, ["trial_index"]);
    const subjectCandidate = result.candidates.find(c => c.column === "subject_id");
    expect(subjectCandidate).toBeDefined();
    expect(subjectCandidate!.makesUnique).toBe(true);
  });

  test("marks condition as makesUnique: false (constant column, does not help)", () => {
    const result = analyzeJoinKeys(rows, ["trial_index"]);
    const condCandidate = result.candidates.find(c => c.column === "condition");
    expect(condCandidate).toBeDefined();
    expect(condCandidate!.makesUnique).toBe(false);
  });

  test("suggestedAdditionalKeys is [] when sufficient single candidates exist", () => {
    const result = analyzeJoinKeys(rows, ["trial_index"]);
    // subject_id alone is sufficient, so suggestedAdditionalKeys signals "pick one"
    expect(result.suggestedAdditionalKeys).toEqual([]);
  });

  test("suggestedAdditionalKeys is non-empty when no single column is sufficient", () => {
    // Build data where neither subject_id nor session alone is enough,
    // but together they are. All rows share trial_index=0 and the same rt,
    // so neither rt, subject_id, nor session alone achieves uniqueness.
    const noSingleRows = [
      { trial_index: 0, subject_id: "s1", session: "a", rt: 300 },
      { trial_index: 0, subject_id: "s1", session: "b", rt: 300 },
      { trial_index: 0, subject_id: "s2", session: "a", rt: 300 },
      { trial_index: 0, subject_id: "s2", session: "b", rt: 300 },
    ];
    const result = analyzeJoinKeys(noSingleRows, ["trial_index"]);
    expect(result.isUnique).toBe(false);
    expect(result.candidates.some(c => c.makesUnique)).toBe(false);
    expect(result.suggestedAdditionalKeys).not.toBeNull();
    expect(result.suggestedAdditionalKeys!.length).toBeGreaterThan(0);
    // Verify the suggested combination actually achieves uniqueness
    const combined = ["trial_index", ...result.suggestedAdditionalKeys!];
    const compositeKeys = noSingleRows.map(r => combined.map(k => r[k]).join("\0"));
    expect(new Set(compositeKeys).size).toBe(noSingleRows.length);
  });

  test("empty dataset returns isUnique: true", () => {
    const result = analyzeJoinKeys([], ["trial_index"]);
    expect(result.isUnique).toBe(true);
  });
});

// ─── generate() arrayJoinKeys option ─────────────────────────────────────────

describe("generate() arrayJoinKeys option", () => {
  const mockFetch2 = jest.fn().mockResolvedValue({
    text: () => Promise.resolve(""),
  });

  beforeEach(() => {
    (global as any).fetch = mockFetch2;
    mockFetch2.mockClear();
  });

  const multiSubjectData = JSON.stringify([
    { trial_type: "mock-plugin", trial_index: 0, time_elapsed: 100, subject_id: "s1",
      mouse_tracking_data: [{ x: 1, y: 2 }] },
    { trial_type: "mock-plugin", trial_index: 1, time_elapsed: 200, subject_id: "s1",
      mouse_tracking_data: [{ x: 3, y: 4 }] },
    { trial_type: "mock-plugin", trial_index: 0, time_elapsed: 100, subject_id: "s2",
      mouse_tracking_data: [{ x: 5, y: 6 }] },
    { trial_type: "mock-plugin", trial_index: 1, time_elapsed: 200, subject_id: "s2",
      mouse_tracking_data: [{ x: 7, y: 8 }] },
  ]);

  test("custom arrayJoinKeys: extracted rows include all specified join columns", async () => {
    const meta = new JsPsychMetadata();
    await meta.generate(multiSubjectData, {}, "json", { arrayJoinKeys: ["subject_id", "trial_index"] });

    const rows = meta.getExtractedArrays().get("mouse_tracking_data")!;
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ subject_id: "s1", trial_index: 0, element_index: 0, "mouse_tracking_data.x": 1, "mouse_tracking_data.y": 2 });
    expect(rows[2]).toMatchObject({ subject_id: "s2", trial_index: 0, element_index: 0, "mouse_tracking_data.x": 5, "mouse_tracking_data.y": 6 });
  });

  test("custom arrayJoinKeys: composite keys are unique across all extracted rows", async () => {
    const meta = new JsPsychMetadata();
    await meta.generate(multiSubjectData, {}, "json", { arrayJoinKeys: ["subject_id", "trial_index"] });

    const rows = meta.getExtractedArrays().get("mouse_tracking_data")!;
    const keys = rows.map(r => `${r.subject_id}\0${r.trial_index}\0${r.element_index}`);
    expect(new Set(keys).size).toBe(rows.length);
  });

  test("getArrayJoinKeys() returns the keys used in the last generate() call", async () => {
    const meta = new JsPsychMetadata();
    await meta.generate(multiSubjectData, {}, "json", { arrayJoinKeys: ["subject_id", "trial_index"] });
    expect(meta.getArrayJoinKeys()).toEqual(["subject_id", "trial_index"]);
  });

  test("default trial_index behavior is unchanged for single-subject data", async () => {
    const singleSubjectData = JSON.stringify([
      { trial_type: "mock-plugin", trial_index: 0, time_elapsed: 100,
        mouse_tracking_data: [{ x: 1 }] },
    ]);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const meta = new JsPsychMetadata();
    await meta.generate(singleSubjectData);

    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining("not unique"));
    const rows = meta.getExtractedArrays().get("mouse_tracking_data")!;
    expect(rows[0]).toMatchObject({ trial_index: 0, element_index: 0, "mouse_tracking_data.x": 1 });
    warnSpy.mockRestore();
  });

  test("non-unique default keys: console.warn fires with duplicate count", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const meta = new JsPsychMetadata();
    await meta.generate(multiSubjectData);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("not unique"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("duplicate rows"));
    warnSpy.mockRestore();
  });

  test("warning message lists sufficient candidate columns", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const meta = new JsPsychMetadata();
    await meta.generate(multiSubjectData);

    const message = warnSpy.mock.calls[0]?.[0] as string;
    expect(message).toContain("subject_id");
    warnSpy.mockRestore();
  });

  test("processing still completes and extractedArrays is populated even when keys are non-unique", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const meta = new JsPsychMetadata();
    await meta.generate(multiSubjectData);

    expect(meta.getExtractedArrays().has("mouse_tracking_data")).toBe(true);
    warnSpy.mockRestore();
  });

  test("suppressJoinKeyWarning silences the warning but still extracts arrays", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const meta = new JsPsychMetadata();
    await meta.generate(multiSubjectData, {}, "json", { suppressJoinKeyWarning: true });

    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining("not unique"));
    expect(meta.getExtractedArrays().has("mouse_tracking_data")).toBe(true);
    warnSpy.mockRestore();
  });
});

// ─── plain-object sidecar extraction (Option C, recursive) ───────────────────
// A plain (non-array) object column is expanded into dotted variableMeasured names.
// getExtractedObjects() returns one row per trial whose columns are exactly those dotted
// descendant names, so the CLI can write a sidecar CSV that makes them real columns.
// Reuses the same arrayJoinKeys as array extraction — no object-specific join logic.

describe("plain-object column extraction (getExtractedObjects)", () => {
  const mockFetch3 = jest.fn().mockResolvedValue({ text: () => Promise.resolve("") });
  beforeEach(() => { (global as any).fetch = mockFetch3; mockFetch3.mockClear(); });

  const surveyData = JSON.stringify([
    { trial_type: "mock-plugin", trial_index: 0, time_elapsed: 100, response: { cb_1: "7", typed_sequence: "green" } },
    { trial_type: "mock-plugin", trial_index: 1, time_elapsed: 200, response: { cb_1: "3", typed_sequence: "blue" } },
  ]);

  test("flat object: one row per trial, no element_index, join key + dotted columns", async () => {
    const meta = new JsPsychMetadata();
    await meta.generate(surveyData);

    const rows = meta.getExtractedObjects().get("response")!;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ trial_index: 0, "response.cb_1": "7", "response.typed_sequence": "green" });
    expect(rows[1]).toEqual({ trial_index: 1, "response.cb_1": "3", "response.typed_sequence": "blue" });
    expect(rows[0]).not.toHaveProperty("element_index");
  });

  test("VALIDATION INVARIANT: every dotted response.* variable has a matching sidecar column", async () => {
    const meta = new JsPsychMetadata();
    await meta.generate(surveyData);

    const dotted = meta.getVariableNames().filter(n => n.startsWith("response."));
    const rows = meta.getExtractedObjects().get("response")!;
    const joinKeys = meta.getArrayJoinKeys();
    const cols = new Set(rows.flatMap(r => Object.keys(r)).filter(c => !joinKeys.includes(c)));
    for (const name of dotted) expect(cols.has(name)).toBe(true); // no phantom variableMeasured names
  });

  test("CSV input: JSON-string object cells are extracted the same way", async () => {
    const csv = ["trial_type,trial_index,time_elapsed,response",
      'mock-plugin,0,100,"{""cb_1"":""7""}"'].join("\n");
    const meta = new JsPsychMetadata();
    await meta.generate(csv, {}, "csv");
    expect(meta.getExtractedObjects().get("response")![0]).toEqual({ trial_index: "0", "response.cb_1": "7" });
  });

  test("JOIN KEYS: reuses configurable arrayJoinKeys — no object-specific logic", async () => {
    // trial_index repeats across subjects; subject_id disambiguates.
    const multi = JSON.stringify([
      { trial_type: "mock-plugin", trial_index: 0, time_elapsed: 100, subject_id: "s1", response: { cb_1: "a" } },
      { trial_type: "mock-plugin", trial_index: 0, time_elapsed: 100, subject_id: "s2", response: { cb_1: "b" } },
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(multi, {}, "json", { arrayJoinKeys: ["subject_id", "trial_index"] });

    const rows = meta.getExtractedObjects().get("response")!;
    expect(rows[0]).toEqual({ subject_id: "s1", trial_index: 0, "response.cb_1": "a" });
    expect(rows[1]).toEqual({ subject_id: "s2", trial_index: 0, "response.cb_1": "b" });
    expect(new Set(rows.map(r => `${r.subject_id}\0${r.trial_index}`)).size).toBe(rows.length);
  });

  test("deep nesting: leaves AND intermediate object nodes become columns matching variableMeasured", async () => {
    const data = JSON.stringify([
      { trial_type: "mock-plugin", trial_index: 0, time_elapsed: 100,
        response: { Q0: { score: 4, meta: { valid: true } }, flat: 5 } },
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);

    const row = meta.getExtractedObjects().get("response")![0];
    expect(row).toEqual({
      trial_index: 0,
      "response.Q0": { score: 4, meta: { valid: true } },     // intermediate node (JSON at write time)
      "response.Q0.score": 4,
      "response.Q0.meta": { valid: true },                     // intermediate node
      "response.Q0.meta.valid": true,
      "response.flat": 5,
    });
    const cols = new Set(Object.keys(row));
    for (const n of meta.getVariableNames().filter(n => n.startsWith("response."))) expect(cols.has(n)).toBe(true);
  });

  test("nested array inside object: array parent is a sidecar column AND extracted element-wise", async () => {
    const data = JSON.stringify([
      { trial_type: "mock-plugin", trial_index: 0, time_elapsed: 100, response: { samples: [{ x: 1 }, { x: 2 }] } },
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);

    // response.samples is a column in the object sidecar (so it isn't a phantom variableMeasured name)…
    expect(meta.getExtractedObjects().get("response")![0]).toEqual({ trial_index: 0, "response.samples": [{ x: 1 }, { x: 2 }] });
    // …and the nested array is still extracted element-wise by the existing array machinery.
    expect(meta.getExtractedArrays().has("response.samples")).toBe(true);
  });

  test("extractedObjects resets between generate() calls", async () => {
    const meta = new JsPsychMetadata();
    await meta.generate(surveyData);
    expect(meta.getExtractedObjects().get("response")).toHaveLength(2);

    await meta.generate(JSON.stringify([
      { trial_type: "mock-plugin", trial_index: 0, time_elapsed: 100, response: { cb_1: "x" } },
    ]));
    expect(meta.getExtractedObjects().get("response")).toHaveLength(1);
  });

  test("top-level array column goes to extractedArrays, not extractedObjects", async () => {
    const data = JSON.stringify([
      { trial_type: "mock-plugin", trial_index: 0, time_elapsed: 100, mouse_tracking_data: [{ x: 1 }] },
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);

    expect(meta.getExtractedObjects().has("mouse_tracking_data")).toBe(false);
    expect(meta.getExtractedArrays().has("mouse_tracking_data")).toBe(true);
  });
});

// ─── array-element field registration (issue #82) ───────────────────────────
// Array-of-objects columns are extracted to a sidecar CSV. Every column that sidecar
// carries — the dotted element fields and element_index — must be registered in
// variableMeasured so it isn't reported as CSV_COLUMN_MISSING_FROM_METADATA. Element
// fields are recorded one level deep (object/array fields become a single dotted JSON
// column; not further expanded — tracked separately as a follow-up).

describe("array-element field registration", () => {
  const mockFetch4 = jest.fn().mockResolvedValue({ text: () => Promise.resolve("") });
  beforeEach(() => { (global as any).fetch = mockFetch4; mockFetch4.mockClear(); });

  const B = { trial_type: "mock-plugin", trial_index: 0, time_elapsed: 100 };

  test("element fields are registered under dotted names with correct types + min/max", async () => {
    const data = JSON.stringify([
      { ...B, gaze: [{ x: 10, y: 5, valid: true }] },
      { ...B, trial_index: 1, gaze: [{ x: 30, y: 7, valid: false }] },
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);

    const names = meta.getVariableNames();
    expect(names).toContain("gaze.x");
    expect(names).toContain("gaze.y");
    expect(names).toContain("gaze.valid");

    const x = meta.getVariable("gaze.x") as any;
    expect(x.value).toBe("number");
    expect(x.minValue).toBe(10);
    expect(x.maxValue).toBe(30);
    expect((meta.getVariable("gaze.valid") as any).value).toBe("boolean");
  });

  test("element_index is registered exactly once", async () => {
    const data = JSON.stringify([
      { ...B, gaze: [{ x: 1 }], other: [{ y: 2 }] },
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);

    expect(meta.getVariableNames()).toContain("element_index");
    expect((meta.getVariable("element_index") as any).value).toBe("number");
    expect(meta.getVariableNames().filter(n => n === "element_index")).toHaveLength(1);
  });

  test("VALIDATION INVARIANT: every extracted-array sidecar column is in variableMeasured", async () => {
    const data = JSON.stringify([
      { ...B, gaze: [{ x: 1, y: 2 }, { x: 3, y: 4 }], clicks: [{ target: "a", correct: true }] },
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);

    const declared = new Set(meta.getVariableNames());
    for (const [, rows] of meta.getExtractedArrays()) {
      for (const row of rows) {
        for (const col of Object.keys(row)) {
          expect(declared.has(col)).toBe(true); // no column missing from variableMeasured
        }
      }
    }
  });

  test("object element field is expanded; primitive-array element field is extracted under .value", async () => {
    const data = JSON.stringify([
      { ...B, pts: [{ point: { x: 1, y: 2 }, samples: [9, 8] }] },
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);

    const names = meta.getVariableNames();
    expect(names).toContain("pts.point");
    expect((meta.getVariable("pts.point") as any).value).toBe("object");
    // object field IS expanded (recursive)
    expect(names).toContain("pts.point.x");
    expect(names).toContain("pts.point.y");

    // primitive array is now extracted to its own grandchild sidecar under a synthetic .value column
    expect(names).toContain("pts.samples");
    expect((meta.getVariable("pts.samples") as any).value).toBe("array");
    expect(meta.getExtractedArrays().has("pts.samples")).toBe(true);
    expect((meta.getVariable("pts.samples.value") as any).value).toBe("number");
    const sampleRows = meta.getExtractedArrays().get("pts.samples")!;
    expect(sampleRows[0]).toMatchObject({ "pts.element_index": 0, element_index: 0, "pts.samples.value": 9 });

    const row = meta.getExtractedArrays().get("pts")![0];
    expect(row["pts.point.x"]).toBe(1);
    expect(row["pts.point.y"]).toBe(2);
    expect(row["pts.point"]).toEqual({ x: 1, y: 2 }); // node kept as JSON column too
    expect(row["pts.samples"]).toEqual([9, 8]); // array parent kept as JSON column in the pts row
  });

  test("element field that is null in all elements is still declared (no phantom column)", async () => {
    const data = JSON.stringify([
      { ...B, gaze: [{ x: 1, pupil: null }, { x: 2, pupil: null }] },
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);

    expect(meta.getVariableNames()).toContain("gaze.pupil");
    // and the sidecar column exists, so the invariant holds
    const declared = new Set(meta.getVariableNames());
    for (const row of meta.getExtractedArrays().get("gaze")!) {
      for (const col of Object.keys(row)) expect(declared.has(col)).toBe(true);
    }
  });

  test("dotted names prevent collisions between same-named fields of different array columns", async () => {
    const data = JSON.stringify([
      { ...B, gaze: [{ x: 1 }], clicks: [{ x: 999 }] },
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);

    expect((meta.getVariable("gaze.x") as any).minValue).toBe(1);
    expect((meta.getVariable("clicks.x") as any).minValue).toBe(999);
  });
});

// ─── recursive array-element unnesting (deeper levels) ──────────────────────
// Building on the one-level array-element registration: object fields inside an array
// element are expanded into the same row (deeper dotted columns); array fields inside an
// array element are extracted to a grandchild table, joinable to their specific parent
// element via a qualified `<col>.element_index` key.

describe("recursive array-element unnesting", () => {
  const mf = jest.fn().mockResolvedValue({ text: () => Promise.resolve("") });
  beforeEach(() => { (global as any).fetch = mf; mf.mockClear(); });
  const B = { trial_type: "mock-plugin", trial_index: 0, time_elapsed: 100 };

  test("object inside an array element is expanded into the same row (deeper dotted columns)", async () => {
    const data = JSON.stringify([
      { ...B, pts: [{ accuracy: 0.9, point: { x: 1, y: 2 } }] },
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);

    const names = meta.getVariableNames();
    expect(names).toContain("pts.point");      // intermediate node
    expect(names).toContain("pts.point.x");    // expanded leaf
    expect(names).toContain("pts.point.y");
    expect((meta.getVariable("pts.point.x") as any).value).toBe("number");

    const row = meta.getExtractedArrays().get("pts")![0];
    expect(row["pts.point.x"]).toBe(1);
    expect(row["pts.point.y"]).toBe(2);
    expect(meta.getExtractedArrays().has("pts.point")).toBe(false); // plain object → no grandchild table
  });

  test("array inside an array element is extracted to a grandchild table joinable to its parent element", async () => {
    const data = JSON.stringify([
      { ...B, pts: [
        { samples: [{ t: 0, v: 9 }, { t: 1, v: 8 }] },
        { samples: [{ t: 0, v: 7 }] },
      ] },
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);

    const gc = meta.getExtractedArrays().get("pts.samples")!;
    expect(gc).toBeDefined();
    expect(gc).toHaveLength(3);
    // multi-level join key: trial_index + qualified parent index + own element_index
    expect(gc[0]).toMatchObject({ trial_index: 0, "pts.element_index": 0, element_index: 0, "pts.samples.t": 0, "pts.samples.v": 9 });
    expect(gc[1]).toMatchObject({ trial_index: 0, "pts.element_index": 0, element_index: 1, "pts.samples.v": 8 });
    expect(gc[2]).toMatchObject({ trial_index: 0, "pts.element_index": 1, element_index: 0, "pts.samples.v": 7 });

    expect(meta.getVariableNames()).toContain("pts.element_index"); // qualified parent-index key declared
    expect(meta.getVariableNames()).toContain("pts.samples");       // array parent node declared
    expect((meta.getVariable("pts.samples") as any).value).toBe("array");
  });

  test("VALIDATION INVARIANT holds across parent AND grandchild tables", async () => {
    const data = JSON.stringify([
      { ...B, pts: [{ accuracy: 0.9, samples: [{ t: 0, v: 1 }] }] },
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);

    const declared = new Set(meta.getVariableNames());
    for (const [, rows] of meta.getExtractedArrays()) {
      for (const row of rows) {
        for (const col of Object.keys(row)) expect(declared.has(col)).toBe(true);
      }
    }
  });

  test("three levels deep: array → element-array → element-array", async () => {
    const data = JSON.stringify([
      { ...B, a: [{ b: [{ c: [{ leaf: 1 }] }] }] },
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);

    const ggc = meta.getExtractedArrays().get("a.b.c")!;
    expect(ggc).toBeDefined();
    expect(ggc[0]).toMatchObject({
      trial_index: 0,
      "a.element_index": 0,
      "a.b.element_index": 0,
      element_index: 0,
      "a.b.c.leaf": 1,
    });
    const declared = new Set(meta.getVariableNames());
    for (const [, rows] of meta.getExtractedArrays())
      for (const row of rows)
        for (const col of Object.keys(row)) expect(declared.has(col)).toBe(true);
  });
});

// ─── primitive-array extraction (issue #72 §3) ──────────────────────────────
// Arrays of primitives have no field names, so each element is recorded under a synthetic
// `<column>.value` column (distinct from the array parent, which stays value:"array").
// This makes per-element values real, typed variables and keeps the dataset round-tripping.

describe("primitive-array extraction (.value column)", () => {
  const mf = jest.fn().mockResolvedValue({ text: () => Promise.resolve("") });
  beforeEach(() => { (global as any).fetch = mf; mf.mockClear(); });
  const B = { trial_type: "mock-plugin", trial_index: 0, time_elapsed: 100 };

  test("string primitive array → .value with levels", async () => {
    const data = JSON.stringify([
      { ...B, tags: ["a", "b"] },
      { ...B, trial_index: 1, tags: ["b", "c"] },
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);

    expect((meta.getVariable("tags") as any).value).toBe("array");          // parent
    const v = meta.getVariable("tags.value") as any;                         // synthetic element column
    expect(v.value).toBe("string");
    expect(v.levels).toEqual(expect.arrayContaining(["a", "b", "c"]));
    const rows = meta.getExtractedArrays().get("tags")!;
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ trial_index: 0, element_index: 0, "tags.value": "a" });
  });

  test("synthetic .value name is distinct from the array parent (no collision)", async () => {
    const data = JSON.stringify([{ ...B, scores: [1, 2] }]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);
    expect((meta.getVariable("scores") as any).value).toBe("array");
    expect((meta.getVariable("scores.value") as any).value).toBe("number");
  });

  test("VALIDATION INVARIANT holds for primitive-array sidecars", async () => {
    const data = JSON.stringify([
      { ...B, scores: [1, 2, 3], tags: ["x", "y"] },
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);

    const declared = new Set(meta.getVariableNames());
    for (const [, rows] of meta.getExtractedArrays())
      for (const row of rows)
        for (const col of Object.keys(row)) expect(declared.has(col)).toBe(true);
  });

  test("empty primitive array produces no sidecar (parent stays a declared array)", async () => {
    const data = JSON.stringify([{ ...B, failed: [] }]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);
    expect((meta.getVariable("failed") as any).value).toBe("array");
    expect(meta.getExtractedArrays().has("failed")).toBe(false);
  });

  test("mixed object + primitive elements: both columns appear (object fields and .value)", async () => {
    const data = JSON.stringify([
      { ...B, mixed: [{ a: 1 }, 42] },
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);

    const rows = meta.getExtractedArrays().get("mixed")!;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ element_index: 0, "mixed.a": 1 });   // object element
    expect(rows[1]).toMatchObject({ element_index: 1, "mixed.value": 42 }); // primitive element
    const declared = new Set(meta.getVariableNames());
    expect(declared.has("mixed.a")).toBe(true);
    expect(declared.has("mixed.value")).toBe(true);
  });
});
