import fs from "fs";
import os from "os";
import path from "path";
import JsPsychMetadata from "@jspsych/metadata";
import {
  isValidPsychDSDataFilename,
} from "@jspsych/metadata";
import { processDirectory } from "../src/data";

/**
 * Stress regression guard for cross-file output-name collisions — the coverage gap left by the
 * original rename suite. Two source files in different subdirectories share the same stem
 * ("subject-001") AND the same nested array column ("mouse"), so without the run-wide
 * disambiguation sets every one of {main CSV, preserved raw JSON, array sidecar} would collide and
 * silently overwrite its twin. This asserts that processDirectory threads `usedArrayFilenames` /
 * `usedRawFilenames` across files: every output lands under a distinct, still-Psych-DS-compliant
 * name, nothing is overwritten, and the union of CSV columns still round-trips against
 * variableMeasured.
 */

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

// One source file's worth of trials, each with a nested array-of-objects "mouse" column that
// becomes its own sidecar CSV. `seed` keeps the two files' values distinct so an accidental
// overwrite would be detectable, not masked by identical content.
function makeTrials(seed: number) {
  return [
    { trial_type: "html-keyboard-response", trial_index: 0, time_elapsed: 100, rt: 100 + seed, mouse: [{ x: seed, y: 1 }, { x: seed + 1, y: 2 }] },
    { trial_type: "html-keyboard-response", trial_index: 1, time_elapsed: 200, rt: 200 + seed, mouse: [{ x: seed + 2, y: 3 }] },
  ];
}

describe("cross-file output-name collision (stress)", () => {
  let projectDir: string;
  let dataDir: string;
  let total: number;
  let failed: number;
  let csvs: string[];
  let rawFiles: string[];

  beforeAll(async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});

    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "stress-collision-"));
    const inputDir = path.join(projectDir, "input");
    dataDir = path.join(projectDir, "data");
    fs.mkdirSync(path.join(inputDir, "a"), { recursive: true });
    fs.mkdirSync(path.join(inputDir, "b"), { recursive: true });
    fs.mkdirSync(dataDir, { recursive: true });

    // Same filename, same nested column, different subdirectory -> guaranteed three-way collision.
    fs.writeFileSync(path.join(inputDir, "a", "subject-001.json"), JSON.stringify(makeTrials(0)));
    fs.writeFileSync(path.join(inputDir, "b", "subject-001.json"), JSON.stringify(makeTrials(10)));

    const metadata = new JsPsychMetadata();
    metadata.setMetadataField("name", "collision-stress");
    ({ total, failed } = await processDirectory(metadata, inputDir, false, dataDir));
    fs.writeFileSync(
      path.join(projectDir, "dataset_description.json"),
      JSON.stringify(metadata.getMetadata(), null, 2),
    );
    csvs = fs.readdirSync(dataDir).filter((f) => f.endsWith(".csv"));
    rawFiles = fs.existsSync(path.join(dataDir, "raw")) ? fs.readdirSync(path.join(dataDir, "raw")) : [];
  }, 120_000);

  afterAll(() => {
    jest.restoreAllMocks();
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  test("processes both files with no failures", () => {
    expect(total).toBe(2);
    expect(failed).toBe(0);
  });

  test("writes two distinct main CSVs instead of overwriting one", () => {
    const mains = csvs.filter((f) => !f.includes("measure-")).sort();
    expect(mains).toEqual(["subject-0012_data.csv", "subject-001_data.csv"]);
  });

  test("writes two distinct mouse sidecars instead of overwriting one", () => {
    const sidecars = csvs.filter((f) => f.includes("measure-mouse")).sort();
    expect(sidecars).toEqual(["subject-001_measure-mouse2_data.csv", "subject-001_measure-mouse_data.csv"]);
  });

  test("preserves both originals under data/raw/ under distinct names", () => {
    expect(rawFiles.filter((f) => f.endsWith(".json")).sort()).toEqual(["subject-001.json", "subject-0012.json"]);
  });

  test("every written CSV name is unique and Psych-DS compliant", () => {
    expect(new Set(csvs).size).toBe(csvs.length); // no two outputs share a name
    expect(csvs.length).toBe(4); // 2 mains + 2 sidecars
    for (const name of csvs) expect(isValidPsychDSDataFilename(name)).toBe(true);
  });

  test("no original's content was clobbered (each raw file matches one of the two inputs)", () => {
    const contents = rawFiles
      .filter((f) => f.endsWith(".json"))
      .map((f) => fs.readFileSync(path.join(dataDir, "raw", f), "utf8"));
    expect(contents).toEqual(expect.arrayContaining([JSON.stringify(makeTrials(0)), JSON.stringify(makeTrials(10))]));
  });

  test("every variableMeasured name is a column across the written CSVs", () => {
    const allColumns = new Set<string>();
    for (const csv of csvs) {
      const firstLine = fs.readFileSync(path.join(dataDir, csv), "utf8").split(/\r?\n/)[0];
      parseHeader(firstLine).forEach((c) => allColumns.add(c));
    }
    const meta = JSON.parse(fs.readFileSync(path.join(projectDir, "dataset_description.json"), "utf8"));
    const varNames = (meta.variableMeasured ?? []).map((v: any) => (typeof v === "string" ? v : v.name));
    const missing = varNames.filter((n: string) => !allColumns.has(n));
    expect(missing).toEqual([]);
  });
});
