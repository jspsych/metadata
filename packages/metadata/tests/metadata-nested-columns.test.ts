import JsPsychMetadata from "../src/index";

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
});
