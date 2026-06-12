import fs from "fs";
import path from "path";
import JsPsychMetadata from "../src/index";

/**
 * Stress regression guard: generate() over a fixture that exercises every nested-data shape
 * (deep objects, arrays of objects, arrays of arrays, mixed-type columns, a trial_type-less
 * row, unicode, empties) and assert each variable's stored type / levels / range stays coherent.
 *
 * Ported from stress-tests/run-nested.mjs (Pass 1). Three documented findings (F1a, F1b, F2 —
 * see the comments below) are asserted as *current* behavior so this stays green; each is a
 * deviation pending its own intent decision and must not be "fixed" here by loosening.
 */

const fixturePath = path.resolve(__dirname, "../../../dev/stress/nested-all-cases/subject-nested.json");

// Plugin descriptions are fetched from unpkg; stub fetch so the suite is offline-deterministic.
// Nothing this suite asserts (types, levels, ranges) depends on the human-readable descriptions.
const mockFetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });

// Expected variable -> expected stored type. 'numeric' = "registered, any numeric type"; '*' =
// "registered, any type". Derived from the fixture design.
const EXPECTED: Record<string, string> = {
  trial_type: "string", trial_index: "numeric", time_elapsed: "numeric", rt: "number",
  response: "string", "response.Q0": "string", correct: "boolean", always_null: "unknown",
  empty_string: "unknown", numeric_string: "number",
  // Post-#90: "true"/"false" STRINGS stay strings (levels); only genuine JSON booleans are boolean.
  bool_string: "string",
  mixed_col: "string", // mixed numeric/string -> downgraded to categorical
  json_string_object: "object", "json_string_object.nested": "object", "json_string_object.nested.deep": "number",
  json_string_array: "array", "json_string_array.value": "number",
  flat_object: "object", "flat_object.a": "number", "flat_object.b": "string",
  deep_object: "object", "deep_object.l1": "object", "deep_object.l1.l2": "object",
  "deep_object.l1.l2.l3": "object", "deep_object.l1.l2.l3.l4_leaf": "number",
  "deep_object.l1.l2.l3.l4_arr": "array", "deep_object.l1.l2.l3.l4_arr.value": "number",
  "deep_object.l1.l2.l3_leaf": "string", "deep_object.l1.l2_leaf": "boolean",
  object_with_array_of_objects: "object", "object_with_array_of_objects.trials": "array",
  "object_with_array_of_objects.trials.x": "number", "object_with_array_of_objects.trials.y": "number",
  array_primitives: "array", "array_primitives.value": "number",
  array_objects: "array", "array_objects.x": "number", "array_objects.y": "number", "array_objects.t": "number",
  array_of_arrays: "array", "array_of_arrays.value": "array", "array_of_arrays.value.value": "number",
  "array_of_arrays.element_index": "number",
  array_mixed: "array", "array_mixed.value": "string", "array_mixed.three": "number",
  array_deep_objects: "array", "array_deep_objects.meta": "object", "array_deep_objects.meta.tag": "string",
  "array_deep_objects.meta.score": "object", "array_deep_objects.meta.score.raw": "number",
  "array_deep_objects.meta.score.norm": "number",
  empty_object: "object", empty_array: "array",
  varying_object: "object", "varying_object.only_row0": "number", "varying_object.only_row1": "string",
  unicode_col: "string",
  orphan_col: "*", // column from a trial_type-less row: any type, but it must exist
  element_index: "number",
};

// F2 (run-nested RESULTS.md): this boolean column also carries a `levels` array. Asserted as
// known current behavior for this column only, so a NEW boolean-with-levels regression is caught.
const F2_BOOLEAN_WITH_LEVELS = new Set(["correct"]);

describe("nested-data generation coherence (stress)", () => {
  let metadata: JsPsychMetadata;
  let variableMeasured: any[];
  let vars: Map<string, any>;

  beforeAll(async () => {
    (global as any).fetch = mockFetch;
    jest.spyOn(console, "warn").mockImplementation(() => {});
    metadata = new JsPsychMetadata();
    await metadata.generate(fs.readFileSync(fixturePath, "utf8"), {}, "json");
    variableMeasured = metadata.getMetadata().variableMeasured;
    vars = new Map(variableMeasured.map((v: any) => [v.name, v]));
  });

  afterAll(() => jest.restoreAllMocks());

  test("registers every expected variable with the right stored type", () => {
    const mismatches: string[] = [];
    for (const [name, type] of Object.entries(EXPECTED)) {
      const v = vars.get(name);
      if (!v) { mismatches.push(`${name}: MISSING from variableMeasured`); continue; }
      if (type === "*" || type === "numeric") continue;
      if (v.value !== type) mismatches.push(`${name}: expected "${type}", got "${v.value}"`);
    }
    expect(mismatches).toEqual([]);
  });

  test("produces no unexpected variables", () => {
    const unexpected = [...vars.keys()].filter((n) => !(n in EXPECTED));
    expect(unexpected).toEqual([]);
  });

  test("every variable's type/level/range fields are mutually coherent", () => {
    const incoherent: string[] = [];
    for (const v of variableMeasured) {
      const issues: string[] = [];
      const hasRange = v.minValue !== undefined || v.maxValue !== undefined;
      if (v.value === "number") {
        if (v.minValue !== undefined && v.maxValue !== undefined && v.minValue > v.maxValue) issues.push(`min ${v.minValue} > max ${v.maxValue}`);
        if (typeof v.minValue === "number" && !Number.isFinite(v.minValue)) issues.push("non-finite minValue");
        if (v.levels) issues.push("numeric but has levels");
      } else if (v.value === "boolean") {
        if (v.levels && !F2_BOOLEAN_WITH_LEVELS.has(v.name)) issues.push("boolean but has levels");
        if (hasRange) issues.push("boolean but has min/max");
      } else if (v.value === "string") {
        if (hasRange) issues.push("string but has min/max");
      } else if (v.value === "object" || v.value === "array") {
        if (hasRange) issues.push(`${v.value} but has min/max`);
        if (v.levels) issues.push(`${v.value} but has levels`);
      }
      if (issues.length) incoherent.push(`${v.name}: ${issues.join("; ")}`);
    }
    expect(incoherent).toEqual([]);
  });

  test("coerces a numeric-string range and keeps mixed values as levels", () => {
    expect(vars.get("rt").minValue).toBe(98.6); // "98.6" string coerced
    const mixedLevels = ([] as string[]).concat(vars.get("mixed_col").levels ?? []);
    expect(mixedLevels).toEqual(expect.arrayContaining(["10", "oops", "3"]));
  });

  test("F1a: values in a trial_type-less row are dropped from min/max", () => {
    // rt's 9999 lives in the trial_type-less row and is NOT counted, so max stays 1001.
    expect(vars.get("rt").maxValue).toBe(1001);
  });

  test("F1b: a column appearing only in a trial_type-less row stays \"unknown\"", () => {
    expect(vars.get("orphan_col").value).toBe("unknown");
  });

  test("extracts deeply nested array/object columns into sidecars", () => {
    const arrays = metadata.getExtractedArrays();
    expect(arrays.has("deep_object.l1.l2.l3.l4_arr")).toBe(true); // 4 levels down
    expect(arrays.has("array_of_arrays.value")).toBe(true);
    expect(arrays.has("empty_array")).toBe(false); // empty array -> no sidecar rows
  });
});
