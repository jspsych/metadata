import JsPsychMetadata from "../src/index";

// Regression tests for PR #102 (issue #100, items F1/F2).
//
//  F1 — generateMetadata previously returned early when a row had no trial_type, which
//       skipped not just the plugin-description lookup but also the column's type
//       registration and min/max/levels update. A row without a trial_type must still
//       type its columns and feed min/max/levels; only the plugin-sourced *description*
//       is skipped when trial_type is absent.
//
//  F2 — a column already typed boolean (a genuine true/false was seen) absorbs the
//       STRING "true"/"false" instead of recording it as a misleading categorical level.
//       Any other string still accumulates as a real level. PR #90's pure-boolean and
//       pure-string behavior is unchanged.

const mockFetch = jest.fn().mockResolvedValue({ text: () => Promise.resolve("") });

const BASE = { trial_type: "mock-plugin", trial_index: 0, time_elapsed: 100 };

describe("F1: trial_type-less rows are still typed and counted", () => {
  beforeEach(() => {
    (global as any).fetch = mockFetch;
    mockFetch.mockClear();
  });

  test("F1a: a numeric value in a row without trial_type still feeds min/max", async () => {
    const data = JSON.stringify([
      { ...BASE, trial_index: 0, rt: 300 },
      { trial_index: 1, time_elapsed: 200, rt: 9999 }, // no trial_type
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);

    const rt = meta.getVariable("rt") as any;
    expect(rt.value).toBe("number");
    expect(rt.minValue).toBe(300);
    expect(rt.maxValue).toBe(9999); // would be 300 before the fix — row 2's value was dropped
  });

  test("F1b (string): a column only in a trial_type-less row is typed, not left value:'unknown'", async () => {
    const data = JSON.stringify([
      { ...BASE, trial_index: 0 },
      { trial_index: 1, time_elapsed: 200, orphan_col: "hello" }, // no trial_type
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);

    const v = meta.getVariable("orphan_col") as any;
    expect(v.value).toBe("string"); // was "unknown" before the fix
    expect(v.levels).toContain("hello");
  });

  test("F1b (number): a numeric-only column in a trial_type-less row is typed number with min/max", async () => {
    const data = JSON.stringify([
      { ...BASE, trial_index: 0 },
      { trial_index: 1, time_elapsed: 200, orphan_num: 42 }, // no trial_type
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);

    const v = meta.getVariable("orphan_num") as any;
    expect(v.value).toBe("number");
    expect(v.minValue).toBe(42);
    expect(v.maxValue).toBe(42);
  });

  test("only the plugin-sourced description is skipped without a trial_type", async () => {
    // orphan_col never co-occurs with a trial_type, so no plugin description is looked up:
    // it keeps the default description but is still fully typed.
    const data = JSON.stringify([
      { trial_index: 0, time_elapsed: 100, orphan_col: "x" }, // no trial_type at all
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);

    const v = meta.getVariable("orphan_col") as any;
    expect(v.value).toBe("string");
    expect(v.description).toEqual({ default: "unknown" });
  });
});

describe("F2: a boolean column absorbs the string 'true'/'false'", () => {
  beforeEach(() => {
    (global as any).fetch = mockFetch;
    mockFetch.mockClear();
  });

  test("genuine boolean first, then string 'false' — no misleading level is recorded", async () => {
    const data = JSON.stringify([
      { ...BASE, trial_index: 0, correct: true },
      { ...BASE, trial_index: 1, correct: "false" },
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);

    const v = meta.getVariable("correct") as any;
    expect(v.value).toBe("boolean");
    expect(v.levels).toBeUndefined(); // "false" absorbed, not recorded as a categorical level
  });

  test("both string 'true' and 'false' across rows are absorbed into the boolean column", async () => {
    const data = JSON.stringify([
      { ...BASE, trial_index: 0, correct: true },
      { ...BASE, trial_index: 1, correct: "true" },
      { ...BASE, trial_index: 2, correct: "false" },
      { ...BASE, trial_index: 3, correct: false },
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);

    const v = meta.getVariable("correct") as any;
    expect(v.value).toBe("boolean");
    expect(v.levels).toBeUndefined();
  });

  test("a non-boolean string in a boolean column is still recorded as a real mix", async () => {
    const data = JSON.stringify([
      { ...BASE, trial_index: 0, resp: true },
      { ...BASE, trial_index: 1, resp: "maybe" },
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);

    const v = meta.getVariable("resp") as any;
    expect(v.levels).toContain("maybe"); // genuinely mixed → level kept, not absorbed
  });

  // Documents the known order-dependent limitation raised in review of #102: if the STRING
  // "true"/"false" arrives BEFORE any genuine boolean, the column is already typed "string"
  // with levels ["true"], and the later genuine boolean returns early in updateFields — so the
  // level is not retroactively removed. Pinning this makes a future symmetric fix a deliberate,
  // visible change rather than a silent one.
  test("KNOWN LIMITATION: string 'true' seen before a genuine boolean stays a string level", async () => {
    const data = JSON.stringify([
      { ...BASE, trial_index: 0, flag: "true" },
      { ...BASE, trial_index: 1, flag: true },
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);

    const v = meta.getVariable("flag") as any;
    expect(v.value).toBe("string");
    expect(v.levels).toContain("true");
  });

  test("PR #90 behavior unchanged: a pure-boolean column has no levels", async () => {
    const data = JSON.stringify([
      { ...BASE, trial_index: 0, done: true },
      { ...BASE, trial_index: 1, done: false },
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);

    const v = meta.getVariable("done") as any;
    expect(v.value).toBe("boolean");
    expect(v.levels).toBeUndefined();
  });

  test("PR #90 behavior unchanged: a pure-string 'true'/'false' column keeps both levels", async () => {
    // No genuine boolean is ever seen, so the column stays categorical with both levels.
    const data = JSON.stringify([
      { ...BASE, trial_index: 0, label: "true" },
      { ...BASE, trial_index: 1, label: "false" },
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);

    const v = meta.getVariable("label") as any;
    expect(v.value).toBe("string");
    expect(v.levels).toEqual(expect.arrayContaining(["true", "false"]));
  });
});
