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
      expect(rows[0]).toMatchObject({ trial_index: 0, element_index: 0, x: 1, y: 2 });
      expect(rows[1]).toMatchObject({ trial_index: 0, element_index: 1, x: 3, y: 4 });
    });

    test("nested arrays of primitives are typed 'array' but not extracted", async () => {
      const data = JSON.stringify([
        { ...BASE, response: { Q0: { points: [1, 2, 3] } } },
      ]);
      const meta = new JsPsychMetadata();
      await meta.generate(data);

      expect(meta.getExtractedArrays().has("response.Q0.points")).toBe(false);
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
      expect(rows[0]).toMatchObject({ trial_index: 3, element_index: 0, x: 120, y: 340, t: 0 });
      expect(rows[1]).toMatchObject({ trial_index: 3, element_index: 1, x: 121, y: 338, t: 16 });
    });

    test("null elements within an array are skipped without error", async () => {
      const data = JSON.stringify([
        { ...BASE, mouse_tracking_data: [{ x: 1 }, null, { x: 2 }] },
      ]);
      const meta = new JsPsychMetadata();
      await meta.generate(data);

      const rows = meta.getExtractedArrays().get("mouse_tracking_data")!;
      expect(rows).toHaveLength(2);
      expect(rows[0].x).toBe(1);
      expect(rows[1].x).toBe(2);
    });

    test("primitive array [1,2,3] falls through to normal handling — no extracted arrays entry", async () => {
      const data = JSON.stringify([
        { ...BASE, scores: [1, 2, 3] },
      ]);
      const meta = new JsPsychMetadata();
      await meta.generate(data);

      expect(meta.getExtractedArrays().has("scores")).toBe(false);
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
      expect(rows[0]).toMatchObject({ trial_index: 0, element_index: 0, x: 1 });
      expect(rows[1]).toMatchObject({ trial_index: 1, element_index: 0, x: 2 });
      expect(rows[2]).toMatchObject({ trial_index: 1, element_index: 1, x: 3 });
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
      expect(rows[0]).toMatchObject({ trial_index: 0, element_index: 0, x: 99 });
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
    expect(rows[0]).toMatchObject({ subject_id: "s1", trial_index: 0, element_index: 0, x: 1, y: 2 });
    expect(rows[2]).toMatchObject({ subject_id: "s2", trial_index: 0, element_index: 0, x: 5, y: 6 });
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
    expect(rows[0]).toMatchObject({ trial_index: 0, element_index: 0, x: 1 });
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
