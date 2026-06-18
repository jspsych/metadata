import JsPsychMetadata from "../src/index";

/**
 * Stress regression guard for generate() at scale: feed a large synthetic dataset and assert the
 * accumulator stays exact and bounded — numeric min/max reflect the true extremes over thousands
 * of rows, a low-cardinality categorical column dedups to its real distinct set, a high-cardinality
 * column accumulates one level per distinct value (there is no cap on the *number* of levels — only
 * on each level's length), booleans never accrue levels, and the whole pass finishes well within a
 * generous time budget. Complements the correctness-focused nested/CSV suites with a volume check.
 */

const mockFetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });

const N = 5000;
const CATEGORIES = ["alpha", "bravo", "charlie", "delta"];

// Build the dataset deterministically so expected extremes are known exactly. `signed` swings
// positive and negative so min/max can't be faked by a single-sign assumption.
function buildRows(): any[] {
  const rows: any[] = [];
  for (let i = 0; i < N; i++) {
    rows.push({
      trial_type: "html-keyboard-response",
      trial_index: i,
      rt: i, // 0 .. N-1
      signed: i - Math.floor(N / 2), // spans negative and positive
      category: CATEGORIES[i % CATEGORIES.length], // exactly 4 distinct levels
      uid: `id_${i}`, // N distinct levels
      correct: i % 2 === 0, // genuine boolean -> no levels, no range
    });
  }
  return rows;
}

describe("generate() at scale (stress)", () => {
  let vars: Map<string, any>;
  let elapsedMs: number;

  beforeAll(async () => {
    (global as any).fetch = mockFetch;
    jest.spyOn(console, "warn").mockImplementation(() => {});
    const metadata = new JsPsychMetadata();
    const start = Date.now();
    await metadata.generate(JSON.stringify(buildRows()), {}, "json");
    elapsedMs = Date.now() - start;
    vars = new Map(metadata.getMetadata().variableMeasured.map((v: any) => [v.name, v]));
  }, 60_000);

  afterAll(() => jest.restoreAllMocks());

  test(`tracks exact numeric extremes across ${N} rows`, () => {
    expect(vars.get("rt")).toMatchObject({ value: "number", minValue: 0, maxValue: N - 1 });
    expect(vars.get("signed")).toMatchObject({
      value: "number",
      minValue: -Math.floor(N / 2),
      maxValue: N - 1 - Math.floor(N / 2),
    });
  });

  test("dedups a low-cardinality categorical column to its real distinct set", () => {
    const levels = vars.get("category").levels;
    expect(new Set(levels)).toEqual(new Set(CATEGORIES));
    expect(levels.length).toBe(CATEGORIES.length); // no duplicates despite N/4 occurrences each
  });

  test("accumulates one level per distinct value for a high-cardinality column (no count cap)", () => {
    // Documents current behavior: the 50-char cap is per-level, not a cap on how many levels exist.
    expect(vars.get("uid").value).toBe("string");
    expect(vars.get("uid").levels.length).toBe(N);
  });

  test("a genuine boolean column carries neither levels nor a numeric range", () => {
    const v = vars.get("correct");
    expect(v.value).toBe("boolean");
    expect(v.levels).toBeUndefined();
    expect(v.minValue).toBeUndefined();
    expect(v.maxValue).toBeUndefined();
  });

  test(`completes the ${N}-row pass within the time budget`, () => {
    // Pure in-memory accumulation (fetch stubbed); generous ceiling guards against accidental
    // O(n^2) regressions in the hot loop without being flaky on slow CI.
    expect(elapsedMs).toBeLessThan(15_000);
  });
});
