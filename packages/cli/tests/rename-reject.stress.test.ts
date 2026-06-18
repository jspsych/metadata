import fs from "fs";
import os from "os";
import path from "path";
import JsPsychMetadata from "@jspsych/metadata";
import { processDirectory } from "../src/data";

/**
 * Stress regression guard: without a rename plan (the non-interactive path), the conversion must
 * REFUSE a data file whose name can't form a Psych-DS-compliant base — rather than silently
 * inventing a keyword — and write nothing for it. Ported from stress-tests/run-rename.mjs (Pass 2).
 * (Inventing a keyword is the interactive pre-pass's job; it can't be driven without a TTY.)
 */

describe("CLI rejects a non-compliant filename (stress)", () => {
  let tmpDir: string;
  let dataDir: string;
  let badDataDir: string;
  const badFile = "weird name!.json"; // stem can't form a compliant base -> "weird name!_data.csv" is invalid

  let total: number;
  let failed: number;
  let errorOutput: string;

  beforeAll(async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "stress-rename-"));
    dataDir = path.join(tmpDir, "data");
    badDataDir = path.join(tmpDir, "input");
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(badDataDir, { recursive: true });
    fs.writeFileSync(
      path.join(badDataDir, badFile),
      JSON.stringify([{ trial_type: "html-keyboard-response", trial_index: 0, rt: 100 }]),
    );

    const metadata = new JsPsychMetadata();
    metadata.setMetadataField("name", "rename-stress");
    ({ total, failed } = await processDirectory(metadata, badDataDir, false, dataDir));
    errorOutput = errSpy.mock.calls.map((args) => args.join(" ")).join("\n");
  }, 60_000);

  afterAll(() => {
    jest.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("counts the non-compliant file as failed", () => {
    expect(total).toBe(1);
    expect(failed).toBe(1);
  });

  test("writes no data CSVs (fails before writing, never invents a keyword)", () => {
    const csvs = fs.existsSync(dataDir) ? fs.readdirSync(dataDir).filter((f) => f.endsWith(".csv")) : [];
    expect(csvs).toEqual([]);
  });

  test("explains the Psych-DS naming requirement and names the offending file", () => {
    expect(errorOutput).toMatch(/does not follow the Psych-DS naming pattern/);
    expect(errorOutput).toContain(badFile);
  });
});
