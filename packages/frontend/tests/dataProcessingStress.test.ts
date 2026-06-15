import JsPsychMetadata from "@jspsych/metadata";
import { validateWeb } from "psychds-validator/web/psychds-validator.js";
import { validatePsychDS } from "../src/validation/validatePsychDS";
import { validatorOutput } from "./helpers";

const mockValidateWeb = validateWeb as jest.Mock;

interface VariableMeta {
  minValue?: number;
  maxValue?: number;
  levels?: unknown[];
  value?: string;
}

// Mock PluginCache npm fetches — ok:true prevents the "source not found" warn path.
const mockFetch = jest.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve("") });
beforeEach(() => {
  (global as typeof globalThis & { fetch: jest.Mock }).fetch = mockFetch;
  mockFetch.mockClear();
  mockValidateWeb.mockReset();
});
afterEach(() => jest.restoreAllMocks());

// Build a CSV string from an array of row objects.
function makeCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "null";
    const s = String(v);
    return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

function baseRow(overrides: Record<string, unknown> = {}) {
  return { trial_type: "html-keyboard-response", trial_index: 0, time_elapsed: 500, ...overrides };
}

// ─── Scale: large CSV ─────────────────────────────────────────────────────────

describe("Scale: large CSV (1,000 rows)", () => {
  test("detects all 7 variables", async () => {
    const rows = Array.from({ length: 1000 }, (_, i) =>
      baseRow({ trial_index: i, time_elapsed: i * 100, stimulus: `s${i}`, response: i % 2 ? "f" : "j", rt: 400 + i, correct: i % 3 !== 0 }),
    );
    const meta = new JsPsychMetadata();
    await meta.generate(makeCsv(rows), {}, "csv");
    const names = meta.getVariableNames();
    for (const col of ["trial_type", "trial_index", "time_elapsed", "stimulus", "response", "rt", "correct"]) {
      expect(names).toContain(col);
    }
  });

  test("computes correct numeric range across 1,000 rows", async () => {
    const rows = Array.from({ length: 1000 }, (_, i) => baseRow({ trial_index: i, rt: i + 1 }));
    const meta = new JsPsychMetadata();
    await meta.generate(makeCsv(rows), {}, "csv");
    const rt = meta.getVariable("rt") as VariableMeta;
    expect(rt.minValue).toBe(1);
    expect(rt.maxValue).toBe(1000);
  });
});

// ─── Scale: wide CSV ─────────────────────────────────────────────────────────

describe("Scale: wide CSV (31 columns)", () => {
  test("detects all 31 columns", async () => {
    const cols = Array.from({ length: 30 }, (_, i) => `col_${i}`);
    const rows = Array.from({ length: 5 }, (_, i) =>
      Object.fromEntries([["trial_index", i], ...cols.map((c) => [c, i])]),
    );
    const meta = new JsPsychMetadata();
    await meta.generate(makeCsv(rows), {}, "csv");
    const names = meta.getVariableNames();
    expect(names).toContain("trial_index");
    for (const col of cols) expect(names).toContain(col);
  });
});

// ─── Multi-file: CSV + JSON accumulation ─────────────────────────────────────
// The frontend calls generate() once per file. This block guards that shared
// variables don't get duplicated and JSON-only variables are captured.

describe("Multi-file: CSV + JSON accumulation", () => {
  test("shared variables appear exactly once after processing both files", async () => {
    const csvRows = [baseRow({ stimulus: "+", response: "f", rt: 800 })];
    const jsonRows = [{ ...baseRow({ trial_index: 1 }), stimulus: "cat", response: "j", rt: 900 }];

    const meta = new JsPsychMetadata();
    await meta.generate(makeCsv(csvRows), {}, "csv");
    await meta.generate(JSON.stringify(jsonRows), {}, "json");

    const names = meta.getVariableNames();
    expect(names.filter((n) => n === "trial_type").length).toBe(1);
    expect(names.filter((n) => n === "rt").length).toBe(1);
  });

  test("JSON-only variables are added on top of CSV variables", async () => {
    const csvRows = [baseRow({ response: "f" })];
    const jsonRows = [{ ...baseRow(), subject: "s01", response: "j" }];

    const meta = new JsPsychMetadata();
    await meta.generate(makeCsv(csvRows), {}, "csv");
    await meta.generate(JSON.stringify(jsonRows), {}, "json");

    expect(meta.getVariableNames()).toContain("subject");
  });

  test("numeric range spans values from both files", async () => {
    const csvRows = [baseRow({ rt: 200 }), baseRow({ trial_index: 1, rt: 400 })];
    const jsonRows = [{ ...baseRow({ trial_index: 2 }), rt: 100 }, { ...baseRow({ trial_index: 3 }), rt: 800 }];

    const meta = new JsPsychMetadata();
    await meta.generate(makeCsv(csvRows), {}, "csv");
    await meta.generate(JSON.stringify(jsonRows), {}, "json");

    const rt = meta.getVariable("rt") as VariableMeta;
    expect(rt.minValue).toBe(100);
    expect(rt.maxValue).toBe(800);
  });
});

// ─── Type inference ──────────────────────────────────────────────────────────

describe("Type inference", () => {
  test("native boolean values in JSON are typed as boolean", async () => {
    const data = JSON.stringify([
      { ...baseRow(), correct: true },
      { ...baseRow({ trial_index: 1 }), correct: false },
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data, {}, "json");
    expect((meta.getVariable("correct") as VariableMeta).value).toBe("boolean");
  });

  test("null values in a numeric CSV column do not affect range detection", async () => {
    const rows = [
      baseRow({ rt: "null" }),
      baseRow({ trial_index: 1, rt: 500 }),
      baseRow({ trial_index: 2, rt: 800 }),
    ];
    const meta = new JsPsychMetadata();
    await meta.generate(makeCsv(rows), {}, "csv");
    const rt = meta.getVariable("rt") as VariableMeta;
    expect(rt.minValue).toBe(500);
    expect(rt.maxValue).toBe(800);
  });
});

// ─── Many levels: "Show all N" guard ─────────────────────────────────────────
// The Variables step truncates levels at 5 and shows "Show all N". This guard
// ensures that all levels are recorded so the UI's count and full list are correct.

describe("Many levels", () => {
  test("all 50 unique values are stored for a high-cardinality string column", async () => {
    const rows = Array.from({ length: 50 }, (_, i) => baseRow({ trial_index: i, stimulus: `stimulus-${i}` }));
    const meta = new JsPsychMetadata();
    await meta.generate(makeCsv(rows), {}, "csv");
    const stim = meta.getVariable("stimulus") as VariableMeta;
    expect(stim.levels).toHaveLength(50);
  });
});

// ─── Smoke-test-2 regression: validator layer ─────────────────────────────────
// Regression guard for the mixed CSV + JSON case. JSON-only variables (subject,
// response.Q0, response.Q1, element_index, response.value) appear in variableMeasured
// but not in any CSV column, so the validator must report VARIABLE_MISSING_FROM_CSV_COLUMNS.
// PR #103 (fix/frontend-missing-datafile) will resolve this; guard remains until merged.

describe("Smoke-test-2 regression: VARIABLE_MISSING_FROM_CSV_COLUMNS", () => {
  test("JSON-only variables surface as VARIABLE_MISSING_FROM_CSV_COLUMNS", async () => {
    mockValidateWeb.mockResolvedValue(
      validatorOutput([
        {
          key: "VARIABLE_MISSING_FROM_CSV_COLUMNS",
          reason: "variable name in variableMeasured not found in any CSV column",
          severity: "error",
          evidence: ["subject,element_index,response.value,response.Q0,response.Q1"],
        },
      ]),
    );

    const dataFiles = new Map([
      ["experiment/subject-01_data.csv", "trial_type,trial_index,time_elapsed,stimulus,response,rt,correct\nhtml-keyboard-response,0,812,+,null,null,null"],
    ]);

    const result = await validatePsychDS("{}", dataFiles);

    expect(result.valid).toBe(false);
    expect(result.errors[0].key).toBe("VARIABLE_MISSING_FROM_CSV_COLUMNS");
    expect(result.errors[0].evidence[0]).toContain("subject");
    expect(result.errors[0].evidence[0]).toContain("response.Q0");
  });

  test("INVALID_SCHEMAORG_PROPERTY on .levels surfaces as a warning, not an error", async () => {
    mockValidateWeb.mockResolvedValue(
      validatorOutput([
        {
          key: "INVALID_SCHEMAORG_PROPERTY",
          reason: "levels is not a valid schema.org property",
          severity: "warning",
          evidence: [".variableMeasured.levels"],
        },
      ]),
    );

    const result = await validatePsychDS("{}");

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings[0].key).toBe("INVALID_SCHEMAORG_PROPERTY");
  });
});
