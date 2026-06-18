import JsPsychMetadata from "../src/index";

/**
 * Stress regression guard for the CSV ingestion path (generate(data, {}, "csv")).
 *
 * Where nested-generation.stress.test.ts feeds richly-typed JSON, this suite feeds CSV — where
 * every cell arrives as a *string* — and pins how generateObservation re-infers types from those
 * strings: numeric coercion (incl. whitespace, scientific notation, Infinity/NaN rejection),
 * mixed-column downgrade, "true"/"false" staying categorical (post-#90), RFC-4180 quoting
 * (embedded commas / quotes / newlines), unicode, empty / literal-"null" cells, the 50-char level
 * cap, and JSON-in-a-cell extraction. A final case asserts CSV and the equivalent JSON agree on
 * type for the columns where they should.
 */

// Plugin descriptions come from unpkg; stub fetch so the suite is offline-deterministic. Nothing
// asserted here (types / levels / ranges) depends on the human-readable descriptions.
const mockFetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });

/** Minimal RFC-4180 serializer: quote a field iff it contains a comma, quote, CR or LF. */
function toCSV(headers: string[], rows: Record<string, string>[]): string {
  const enc = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map((h) => enc(row[h] ?? "")).join(","));
  return lines.join("\n");
}

const LONG = "x".repeat(80); // > MAX_LENGTH (50) so it must be truncated to first-50 + "..."

// Three observations. Every row carries trial_type so no column is dropped by the trial_type-less
// behavior pinned in nested-generation.stress.test.ts (findings F1a/F1b).
const HEADERS = [
  "trial_type", "trial_index",
  "int_col", "float_col", "ws_num", "sci_num", "neg_num",
  "inf_col", "nan_col", "bool_str", "mixed_col",
  "quoted_comma", "quoted_newline", "quoted_quote", "unicode_col",
  "empty_col", "null_word_col", "long_level_col",
  "json_obj_col", "json_arr_col",
];
const ROWS: Record<string, string>[] = [
  {
    trial_type: "html-keyboard-response", trial_index: "0",
    int_col: "42", float_col: "1.5", ws_num: "  10  ", sci_num: "1e3", neg_num: "-5",
    inf_col: "Infinity", nan_col: "NaN", bool_str: "TRUE", mixed_col: "10",
    quoted_comma: "a,b", quoted_newline: "line1\nline2", quoted_quote: 'say "hi"', unicode_col: "café",
    empty_col: "", null_word_col: "null", long_level_col: LONG,
    json_obj_col: '{"a": 1, "b": "x"}', json_arr_col: "[1, 2, 3]",
  },
  {
    trial_type: "html-keyboard-response", trial_index: "1",
    int_col: "7", float_col: "2.25", ws_num: "  20  ", sci_num: "2e3", neg_num: "-1",
    inf_col: "Infinity", nan_col: "NaN", bool_str: "FALSE", mixed_col: "oops",
    quoted_comma: "c,d", quoted_newline: "x\ny", quoted_quote: 'a""b', unicode_col: "日本語",
    empty_col: "", null_word_col: "null", long_level_col: "short",
    json_obj_col: '{"a": 9, "b": "y"}', json_arr_col: "[4, 5]",
  },
  {
    trial_type: "html-keyboard-response", trial_index: "2",
    int_col: "100", float_col: "0.5", ws_num: "  30  ", sci_num: "1.5e3", neg_num: "-10",
    inf_col: "Infinity", nan_col: "NaN", bool_str: "true", mixed_col: "3",
    quoted_comma: "e,f", quoted_newline: "p\nq", quoted_quote: 'plain', unicode_col: "emoji👋",
    empty_col: "", null_word_col: "null", long_level_col: "short",
    json_obj_col: '{"a": 50, "b": "z"}', json_arr_col: "[6]",
  },
];

describe("CSV ingestion type-inference (stress)", () => {
  let vars: Map<string, any>;
  let metadata: JsPsychMetadata;

  beforeAll(async () => {
    (global as any).fetch = mockFetch;
    jest.spyOn(console, "warn").mockImplementation(() => {});
    metadata = new JsPsychMetadata();
    await metadata.generate(toCSV(HEADERS, ROWS), {}, "csv");
    vars = new Map(metadata.getMetadata().variableMeasured.map((v: any) => [v.name, v]));
  });

  afterAll(() => jest.restoreAllMocks());

  test("coerces integers, floats, scientific notation and negatives to numeric ranges", () => {
    expect(vars.get("int_col")).toMatchObject({ value: "number", minValue: 7, maxValue: 100 });
    expect(vars.get("float_col")).toMatchObject({ value: "number", minValue: 0.5, maxValue: 2.25 });
    expect(vars.get("sci_num")).toMatchObject({ value: "number", minValue: 1000, maxValue: 2000 });
    expect(vars.get("neg_num")).toMatchObject({ value: "number", minValue: -10, maxValue: -1 });
    // No numeric column should carry levels.
    for (const n of ["int_col", "float_col", "sci_num", "neg_num"]) expect(vars.get(n).levels).toBeUndefined();
  });

  test("trims surrounding whitespace before the numeric test (Number(' 10 ') === 10)", () => {
    expect(vars.get("ws_num")).toMatchObject({ value: "number", minValue: 10, maxValue: 30 });
  });

  test("rejects Infinity / NaN as non-numeric and keeps them as string levels", () => {
    // Number.isFinite (not !isNaN) is the gate, so these never leak into a numeric range.
    expect(vars.get("inf_col").value).toBe("string");
    expect(vars.get("inf_col").minValue).toBeUndefined();
    expect(vars.get("inf_col").levels).toEqual(["Infinity"]);
    expect(vars.get("nan_col").value).toBe("string");
    expect(vars.get("nan_col").levels).toEqual(["NaN"]);
  });

  test('keeps "true"/"false" strings categorical (only genuine JSON booleans are boolean)', () => {
    const v = vars.get("bool_str");
    expect(v.value).toBe("string");
    expect(v.levels).toEqual(expect.arrayContaining(["TRUE", "FALSE", "true"]));
    expect(v.minValue).toBeUndefined();
  });

  test("downgrades a numeric-then-string column to categorical, preserving the numeric boundary as a level", () => {
    const v = vars.get("mixed_col");
    expect(v.value).toBe("string");
    expect(v.minValue).toBeUndefined();
    // "10" seen first (numeric boundary), then "oops", then "3".
    expect(v.levels).toEqual(["10", "oops", "3"]);
  });

  test("parses RFC-4180 quoted fields (embedded comma, quote, newline) without corruption", () => {
    expect(vars.get("quoted_comma").levels).toEqual(["a,b", "c,d", "e,f"]);
    expect(vars.get("quoted_newline").levels).toEqual(["line1\nline2", "x\ny", "p\nq"]);
    expect(vars.get("quoted_quote").levels).toEqual(['say "hi"', 'a""b', "plain"]);
  });

  test("preserves unicode in level strings", () => {
    expect(vars.get("unicode_col").levels).toEqual(["café", "日本語", "emoji👋"]);
  });

  test('treats empty cells and the literal string "null" as no-value (column stays "unknown")', () => {
    for (const n of ["empty_col", "null_word_col"]) {
      const v = vars.get(n);
      expect(v.value).toBe("unknown");
      expect(v.levels).toBeUndefined();
    }
  });

  test("caps an over-long level at 50 chars + ellipsis", () => {
    const v = vars.get("long_level_col");
    const truncated = "x".repeat(50) + "...";
    expect(v.levels).toEqual(expect.arrayContaining([truncated, "short"]));
    expect(v.levels).not.toContain(LONG); // the full 80-char string is never stored
  });

  test("parses a JSON object / array embedded in a CSV cell and extracts its sub-columns", () => {
    expect(vars.get("json_obj_col").value).toBe("object");
    expect(vars.get("json_obj_col.a")).toMatchObject({ value: "number", minValue: 1, maxValue: 50 });
    expect(vars.get("json_obj_col.b").value).toBe("string");
    expect(vars.get("json_arr_col").value).toBe("array");
    const arrays = metadata.getExtractedArrays();
    expect(arrays.has("json_arr_col")).toBe(true);
  });
});

describe("CSV / JSON parity for unambiguously-typed columns (stress)", () => {
  // Booleans and nulls intentionally differ between the two formats (a CSV "true" is a string
  // level; a JSON true is a boolean), so this parity check is restricted to numeric and plain
  // string columns, where CSV coercion must reproduce exactly what native JSON typing produces.
  const headers = ["trial_type", "trial_index", "num", "word"];
  const rows = [
    { trial_type: "t", trial_index: "0", num: "5", word: "alpha" },
    { trial_type: "t", trial_index: "1", num: "9", word: "beta" },
    { trial_type: "t", trial_index: "2", num: "1", word: "alpha" },
  ];

  test("CSV and the equivalent JSON yield identical type/range/levels for num & word", async () => {
    (global as any).fetch = mockFetch;
    jest.spyOn(console, "warn").mockImplementation(() => {});

    const fromCsv = new JsPsychMetadata();
    await fromCsv.generate(toCSV(headers, rows), {}, "csv");

    const json = rows.map((r) => ({ ...r, trial_index: Number(r.trial_index), num: Number(r.num) }));
    const fromJson = new JsPsychMetadata();
    await fromJson.generate(JSON.stringify(json), {}, "json");

    const pick = (m: JsPsychMetadata, name: string) => {
      const v = m.getMetadata().variableMeasured.find((x: any) => x.name === name);
      return { value: v.value, minValue: v.minValue, maxValue: v.maxValue, levels: v.levels };
    };
    expect(pick(fromCsv, "num")).toEqual(pick(fromJson, "num"));
    expect(pick(fromCsv, "word")).toEqual(pick(fromJson, "word"));

    jest.restoreAllMocks();
  });
});
