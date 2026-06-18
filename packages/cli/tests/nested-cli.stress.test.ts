import fs from "fs";
import os from "os";
import path from "path";
import JsPsychMetadata from "@jspsych/metadata";
import { processDirectory } from "../src/data";

/**
 * Stress regression guard: run the CLI's real conversion pipeline (processDirectory) on the
 * comprehensive nested-data fixture and assert the full Psych-DS output is coherent —
 * a compliant main CSV, the original JSON preserved under data/raw/, and a clean two-way match
 * between variableMeasured and the actual CSV columns. Ported from stress-tests/run-nested.mjs
 * (Passes 2-4). The Psych-DS validator pass needs network (it fetches the schema), so it is
 * best-effort: it asserts 0 errors when it can run and is skipped offline, while the structural
 * and column-cross-check assertions run unconditionally.
 */

const fixtureDir = path.resolve(__dirname, "../../../dev/stress/nested-all-cases");

// Minimal RFC-4180 header parser (handles quoted fields containing commas).
function parseHeader(line: string): string[] {
  const cols: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { cols.push(cur); cur = ""; }
    else cur += c;
  }
  cols.push(cur);
  return cols;
}

describe("nested-data CLI end-to-end (stress)", () => {
  let projectDir: string;
  let dataDir: string;
  let total: number;
  let failed: number;
  let writtenCsvs: string[];

  beforeAll(async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "stress-nested-"));
    dataDir = path.join(projectDir, "data");
    fs.mkdirSync(dataDir, { recursive: true });

    const metadata = new JsPsychMetadata();
    metadata.setMetadataField("name", "nested-stress");
    ({ total, failed } = await processDirectory(metadata, fixtureDir, false, dataDir));
    fs.writeFileSync(
      path.join(projectDir, "dataset_description.json"),
      JSON.stringify(metadata.getMetadata(), null, 2),
    );
    writtenCsvs = fs.readdirSync(dataDir).filter((f) => f.endsWith(".csv"));
  }, 120_000);

  afterAll(() => {
    jest.restoreAllMocks();
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  test("processes the fixture with no failures", () => {
    expect(total).toBe(1);
    expect(failed).toBe(0);
  });

  test("writes a compliant main CSV from the source filename", () => {
    expect(writtenCsvs).toContain("subject-nested_data.csv");
  });

  test("preserves the original JSON under data/raw/", () => {
    expect(fs.existsSync(path.join(dataDir, "raw", "subject-nested.json"))).toBe(true);
  });

  test("writes sidecar CSVs for the nested array/object columns", () => {
    // The fixture has many nested columns; expect more than just the main CSV.
    expect(writtenCsvs.length).toBeGreaterThan(1);
  });

  test("every variableMeasured name is a CSV column and vice versa", () => {
    const allColumns = new Set<string>();
    for (const csv of writtenCsvs) {
      const firstLine = fs.readFileSync(path.join(dataDir, csv), "utf8").split(/\r?\n/)[0];
      parseHeader(firstLine).forEach((c) => allColumns.add(c));
    }
    const meta = JSON.parse(fs.readFileSync(path.join(projectDir, "dataset_description.json"), "utf8"));
    const varNames = new Set(
      (meta.variableMeasured ?? []).map((v: any) => (typeof v === "string" ? v : v.name)),
    );

    const varsWithoutColumn = [...varNames].filter((n) => !allColumns.has(n as string));
    const columnsWithoutVar = [...allColumns].filter((c) => !varNames.has(c));
    expect(varsWithoutColumn).toEqual([]);
    expect(columnsWithoutVar).toEqual([]);
  });

  test("the written dataset passes Psych-DS validation (best-effort; needs network)", async () => {
    let ran = false;
    let errors: string[] = [];
    try {
      const { validate } = await import("psychds-validator");
      const result: any = await validate(path.relative(process.cwd(), projectDir).replace(/\\/g, "/"));
      ran = true;
      for (const [, issue] of result.issues) if (issue.severity === "error") errors.push(issue.key);
    } catch {
      // No network / validator could not run — the structural checks above are the source of truth.
    }
    if (ran) expect(errors).toEqual([]);
    else console.warn("Psych-DS validation skipped: validator could not run (needs network).");
  }, 120_000);
});
