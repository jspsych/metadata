import fs from "fs";
import os from "os";
import path from "path";
import JsPsychMetadata, { analyzeJoinKeys } from "@jspsych/metadata";
import { processOptions, loadMetadata, saveTextToPath, processDirectory, preAnalyzeDirectory, resolveJoinKeysNonInteractive, enumerateDataFiles, analyzeOutputColumns, RenamePlanError } from "../src/data";
import { planRenames } from "../src/rename";

// Each describe block gets its own temp directory.
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-data-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("saveTextToPath", () => {
  test("writes content to a new file", async () => {
    const filePath = path.join(tmpDir, "output.json");
    await saveTextToPath('{"name":"test"}', filePath);
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, "utf8")).toBe('{"name":"test"}');
  });

  test("overwrites an existing file", async () => {
    const filePath = path.join(tmpDir, "output.json");
    fs.writeFileSync(filePath, "old content");
    await saveTextToPath("new content", filePath);
    expect(fs.readFileSync(filePath, "utf8")).toBe("new content");
  });
});

describe("processOptions", () => {
  test("applies metadata options from a valid JSON file", async () => {
    const options = { name: "My Experiment", description: "A test study" };
    const optionsPath = path.join(tmpDir, "options.json");
    fs.writeFileSync(optionsPath, JSON.stringify(options));

    const metadata = new JsPsychMetadata();
    const result = await processOptions(metadata, optionsPath);

    expect(result).toBe(true);
    expect(metadata.getMetadataField("name")).toBe("My Experiment");
    expect(metadata.getMetadataField("description")).toBe("A test study");
  });

  test("returns false for a non-existent options file", async () => {
    const metadata = new JsPsychMetadata();
    const result = await processOptions(metadata, path.join(tmpDir, "missing.json"));
    expect(result).toBe(false);
  });

  test("returns false for a file with invalid JSON", async () => {
    const badPath = path.join(tmpDir, "bad.json");
    fs.writeFileSync(badPath, "not valid json {{");
    const metadata = new JsPsychMetadata();
    const result = await processOptions(metadata, badPath);
    expect(result).toBe(false);
  });
});

describe("loadMetadata", () => {
  test("loads metadata from a valid dataset_description.json", async () => {
    const existing = { name: "Loaded Study", description: "Pre-existing metadata" };
    const filePath = path.join(tmpDir, "dataset_description.json");
    fs.writeFileSync(filePath, JSON.stringify(existing));

    const metadata = new JsPsychMetadata();
    const result = await loadMetadata(metadata, filePath);

    expect(result).toBe(true);
    expect(metadata.getMetadataField("name")).toBe("Loaded Study");
  });

  test("returns false when the file is not named dataset_description.json", async () => {
    const filePath = path.join(tmpDir, "other.json");
    fs.writeFileSync(filePath, JSON.stringify({ name: "test" }));

    const metadata = new JsPsychMetadata();
    const result = await loadMetadata(metadata, filePath);
    expect(result).toBe(false);
  });

  test("returns false for a non-existent file", async () => {
    const metadata = new JsPsychMetadata();
    const result = await loadMetadata(metadata, path.join(tmpDir, "dataset_description.json"));
    expect(result).toBe(false);
  });
});

describe("processDirectory", () => {
  test("processes a directory of CSV files and returns correct counts", async () => {
    fs.writeFileSync(path.join(tmpDir, "trial1.csv"), "trial_type,rt\njsPsych-html-keyboard-response,450");
    fs.writeFileSync(path.join(tmpDir, "trial2.csv"), "trial_type,rt\njsPsych-html-keyboard-response,512");

    const metadata = new JsPsychMetadata();
    const { total, failed } = await processDirectory(metadata, tmpDir);

    expect(total).toBe(2);
    expect(failed).toBe(0);
  });

  test("processes a directory of JSON files", async () => {
    const data = JSON.stringify([{ trial_type: "jsPsych-html-keyboard-response", rt: 450 }]);
    fs.writeFileSync(path.join(tmpDir, "data.json"), data);

    const metadata = new JsPsychMetadata();
    const { total, failed } = await processDirectory(metadata, tmpDir);

    expect(total).toBe(1);
    expect(failed).toBe(0);
  });

  test("processes a JSON-Lines (.jsonl) file with one participant array per line", async () => {
    // JATOS-style export: each line is a full participant array, not one big array.
    const p1 = JSON.stringify([{ trial_type: "html-keyboard-response", trial_index: 0, rt: 450 }]);
    const p2 = JSON.stringify([{ trial_type: "html-keyboard-response", trial_index: 0, rt: 512 }]);
    fs.writeFileSync(path.join(tmpDir, "raw.jsonl"), `${p1}\n${p2}\n`);

    const metadata = new JsPsychMetadata();
    const { total, failed } = await processDirectory(metadata, tmpDir);

    expect(total).toBe(1);
    expect(failed).toBe(0);
    // rows from both lines were ingested (rt spans both participants).
    const rt = metadata.getVariable("rt") as any;
    expect(rt.minValue).toBe(450);
    expect(rt.maxValue).toBe(512);
  });

  test("counts unsupported file types as failed", async () => {
    fs.writeFileSync(path.join(tmpDir, "notes.txt"), "just a text file");

    const metadata = new JsPsychMetadata();
    const { total, failed } = await processDirectory(metadata, tmpDir);

    expect(total).toBe(1);
    expect(failed).toBe(1);
  });

  test("processes subdirectories one level deep", async () => {
    const subDir = path.join(tmpDir, "sub");
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(subDir, "trial.csv"), "trial_type,rt\njsPsych-html-keyboard-response,300");

    const metadata = new JsPsychMetadata();
    const { total, failed } = await processDirectory(metadata, tmpDir);

    expect(total).toBe(1);
    expect(failed).toBe(0);
  });

  test("warns once about a nested directory two levels deep", async () => {
    const subDir = path.join(tmpDir, "sub");
    fs.mkdirSync(path.join(subDir, "deeper"), { recursive: true });
    fs.writeFileSync(path.join(subDir, "trial.csv"), "trial_type,rt\njsPsych-html-keyboard-response,300");

    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const metadata = new JsPsychMetadata();
      await processDirectory(metadata, tmpDir);

      // The file one level deep is still read; only the doubly-nested directory triggers the warning.
      // Filter to the depth warning specifically: generate() may emit unrelated warnings (e.g. a
      // plugin-source fetch 404), and this test's intent is only that the depth warning fires once.
      const deepDirCalls = warn.mock.calls.filter(
        (args) => args[0] === "Can only read subdirectories one level deep:",
      );
      expect(deepDirCalls).toHaveLength(1);
      expect(deepDirCalls[0][1]).toBe(tmpDir);
    } finally {
      warn.mockRestore();
    }
  });

  test("silent pre-passes (enumerateDataFiles) do not emit the deep-directory warning", async () => {
    const subDir = path.join(tmpDir, "sub");
    fs.mkdirSync(path.join(subDir, "deeper"), { recursive: true });
    fs.writeFileSync(path.join(subDir, "trial.csv"), "trial_type,rt\njsPsych-html-keyboard-response,300");

    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const files = await enumerateDataFiles(tmpDir);

      // Same one-level-deep traversal, but the pre-pass stays quiet so processDirectory's
      // warning isn't duplicated when both run on the same directory in one command.
      expect(files.map((f) => f.name)).toEqual(["trial.csv"]);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  test("skips dataset_description.json (loads it as existing metadata instead)", async () => {
    const existing = JSON.stringify({ name: "Existing", "@type": "Dataset", description: { default: "test" }, variableMeasured: [] });
    fs.writeFileSync(path.join(tmpDir, "dataset_description.json"), existing);
    fs.writeFileSync(path.join(tmpDir, "trial.csv"), "trial_type,rt\njsPsych-html-keyboard-response,450");

    const metadata = new JsPsychMetadata();
    const { total, failed } = await processDirectory(metadata, tmpDir);

    // dataset_description.json is counted but loaded as metadata, not as a data failure
    expect(failed).toBe(0);
    expect(metadata.getMetadataField("name")).toBe("Existing");
  });
});

describe("preAnalyzeDirectory", () => {
  test("returns null for a directory that cannot be read", async () => {
    const missing = path.join(tmpDir, "does-not-exist");
    expect(await preAnalyzeDirectory(missing)).toBeNull();
  });

  test("returns null when every file is unique on the default join key", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "unique.json"),
      JSON.stringify([{ trial_index: 0 }, { trial_index: 1 }, { trial_index: 2 }])
    );
    expect(await preAnalyzeDirectory(tmpDir)).toBeNull();
  });

  test("flags a file whose default join key is not unique", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "dupes.json"),
      JSON.stringify([{ trial_index: 0 }, { trial_index: 0 }])
    );

    const result = await preAnalyzeDirectory(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.fileName).toBe("dupes.json");
    expect(result!.analysis.isUnique).toBe(false);
  });

  test("reports a synthesized source_record_id via the out-param for JSON-Lines input", async () => {
    // JSON-Lines (one array per line) with no id column → source_record_id is synthesized.
    fs.writeFileSync(
      path.join(tmpDir, "jsonl.jsonl"),
      `[{"trial_index":0},{"trial_index":1}]\n[{"trial_index":0}]`
    );

    const stats: { synthesizedSourceRecordId?: boolean } = {};
    await preAnalyzeDirectory(tmpDir, ["trial_index"], stats);
    expect(stats.synthesizedSourceRecordId).toBe(true);
  });

  test("does not report a synthesized source_record_id for a single JSON array", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "single.json"),
      JSON.stringify([{ trial_index: 0 }, { trial_index: 1 }])
    );

    const stats: { synthesizedSourceRecordId?: boolean } = {};
    await preAnalyzeDirectory(tmpDir, ["trial_index"], stats);
    expect(stats.synthesizedSourceRecordId).toBeUndefined();
  });

  test("parses CSV data files as well as JSON", async () => {
    fs.writeFileSync(path.join(tmpDir, "dupes.csv"), "trial_index\n0\n0");

    const result = await preAnalyzeDirectory(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.fileName).toBe("dupes.csv");
    expect(result!.analysis.isUnique).toBe(false);
  });

  test("ignores dataset_description.json and unsupported file types", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "dataset_description.json"),
      JSON.stringify([{ trial_index: 0 }, { trial_index: 0 }])
    );
    fs.writeFileSync(path.join(tmpDir, "notes.txt"), "trial_index\n0\n0");

    expect(await preAnalyzeDirectory(tmpDir)).toBeNull();
  });

  test("returns the worst file (highest duplicate count) when several are non-unique", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "a.json"),
      JSON.stringify([{ trial_index: 0 }, { trial_index: 0 }])
    );
    fs.writeFileSync(
      path.join(tmpDir, "b.json"),
      JSON.stringify([
        { trial_index: 0 },
        { trial_index: 0 },
        { trial_index: 0 },
        { trial_index: 0 },
      ])
    );

    const result = await preAnalyzeDirectory(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.fileName).toBe("b.json");
  });

  test("inspects data files one subdirectory deep", async () => {
    const subDir = path.join(tmpDir, "sub");
    fs.mkdirSync(subDir);
    fs.writeFileSync(
      path.join(subDir, "dupes.json"),
      JSON.stringify([{ trial_index: 0 }, { trial_index: 0 }])
    );

    const result = await preAnalyzeDirectory(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.fileName).toBe("dupes.json");
  });

  test("honors a custom set of initial join keys", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "data.json"),
      JSON.stringify([
        { trial_index: 0, subject: "s1" },
        { trial_index: 0, subject: "s2" },
      ])
    );

    // Unique on [subject] even though trial_index repeats.
    expect(await preAnalyzeDirectory(tmpDir, ["subject"])).toBeNull();
    // Not unique on the default [trial_index].
    expect(await preAnalyzeDirectory(tmpDir, ["trial_index"])).not.toBeNull();
  });
});

describe("processDirectory JSON → CSV conversion", () => {
  test("writes a converted CSV to data/ and preserves the original JSON under data/raw/", async () => {
    const srcDir = path.join(tmpDir, "src");
    const dataDir = path.join(tmpDir, "data");
    fs.mkdirSync(srcDir);
    fs.mkdirSync(dataDir);

    const rows = [
      { trial_index: 0, rt: 200, response: { Q0: "yes" } },
      { trial_index: 1, rt: 350, tags: ["a", "b"] },
    ];
    const original = JSON.stringify(rows);
    fs.writeFileSync(path.join(srcDir, "experiment.json"), original);

    // mimic the CLI pre-pass: a non-compliant source name gets a resolved base
    const normalizedBases = new Map([[path.resolve(srcDir, "experiment.json"), "subject-experiment"]]);

    const metadata = new JsPsychMetadata();
    await processDirectory(metadata, srcDir, false, dataDir, { normalizedBases });

    // converted CSV is written under the resolved Psych-DS-compliant name
    const csvPath = path.join(dataDir, "subject-experiment_data.csv");
    const rawPath = path.join(dataDir, "raw", "experiment.json");
    expect(fs.existsSync(csvPath)).toBe(true);
    expect(fs.existsSync(rawPath)).toBe(true);

    // raw copy is byte-for-byte the original
    expect(fs.readFileSync(rawPath, "utf8")).toBe(original);

    // nested values are serialised as JSON, never "[object Object]"
    const csv = fs.readFileSync(csvPath, "utf8");
    expect(csv).not.toContain("[object Object]");
    expect(csv).toContain('{""Q0"":""yes""}'); // escaped nested object
    expect(csv).toContain('[""a"",""b""]');     // escaped nested array

    // the original .json is not left behind in data/
    expect(fs.existsSync(path.join(dataDir, "experiment.json"))).toBe(false);
  });

  test("does not convert or copy dataset_description.json into data/", async () => {
    const srcDir = path.join(tmpDir, "src");
    const dataDir = path.join(tmpDir, "data");
    fs.mkdirSync(srcDir);
    fs.mkdirSync(dataDir);
    fs.writeFileSync(
      path.join(srcDir, "dataset_description.json"),
      JSON.stringify({ name: "X", "@type": "Dataset", description: { default: "d" }, variableMeasured: [] }),
    );

    const metadata = new JsPsychMetadata();
    await processDirectory(metadata, srcDir, false, dataDir);

    expect(fs.existsSync(path.join(dataDir, "dataset_description.csv"))).toBe(false);
    expect(fs.existsSync(path.join(dataDir, "raw", "dataset_description.json"))).toBe(false);
  });

  test("disambiguates a second same-named JSON file instead of overwriting or dropping it", async () => {
    const srcDir = path.join(tmpDir, "src");
    const dataDir = path.join(tmpDir, "data");
    fs.mkdirSync(path.join(srcDir, "a"), { recursive: true });
    fs.mkdirSync(path.join(srcDir, "b"), { recursive: true });
    fs.mkdirSync(dataDir);
    fs.writeFileSync(path.join(srcDir, "a", "data.json"), JSON.stringify([{ trial_index: 0, rt: 1 }]));
    fs.writeFileSync(path.join(srcDir, "b", "data.json"), JSON.stringify([{ trial_index: 0, rt: 2 }]));

    // both source files resolve to the SAME base, forcing a collision in data/ and data/raw/
    const normalizedBases = new Map([
      [path.resolve(srcDir, "a", "data.json"), "subject-data"],
      [path.resolve(srcDir, "b", "data.json"), "subject-data"],
    ]);

    const metadata = new JsPsychMetadata();
    const { total, failed } = await processDirectory(metadata, srcDir, false, dataDir, { normalizedBases });

    expect(total).toBe(2);
    expect(failed).toBe(0); // both files are kept; the colliding one gets a disambiguated name
    expect(fs.existsSync(path.join(dataDir, "subject-data_data.csv"))).toBe(true);
    expect(fs.existsSync(path.join(dataDir, "subject-data2_data.csv"))).toBe(true);

    // both raw originals are preserved distinctly (neither overwrites the other)
    const rawDir = path.join(dataDir, "raw");
    expect(fs.existsSync(path.join(rawDir, "data.json"))).toBe(true);
    expect(fs.existsSync(path.join(rawDir, "data2.json"))).toBe(true);
    const rawContents = fs.readdirSync(rawDir).map((f) => fs.readFileSync(path.join(rawDir, f), "utf8")).sort();
    expect(rawContents).toEqual([
      JSON.stringify([{ trial_index: 0, rt: 1 }]),
      JSON.stringify([{ trial_index: 0, rt: 2 }]),
    ]);
  });

  test("preserves an already-compliant CSV name and renames a non-compliant one to its resolved base", async () => {
    const srcDir = path.join(tmpDir, "src");
    const dataDir = path.join(tmpDir, "data");
    fs.mkdirSync(srcDir);
    fs.mkdirSync(dataDir);
    // subject-1_data.csv is already compliant → preserved via the fileStem fallback (no map entry needed);
    // trial.csv is non-compliant → renamed using the resolved base from the pre-pass.
    fs.writeFileSync(path.join(srcDir, "subject-1_data.csv"), "trial_type,rt\njsPsych-html-keyboard-response,450");
    fs.writeFileSync(path.join(srcDir, "trial.csv"), "trial_type,rt\njsPsych-html-keyboard-response,512");

    const normalizedBases = new Map([[path.resolve(srcDir, "trial.csv"), "subject-trial"]]);

    const metadata = new JsPsychMetadata();
    await processDirectory(metadata, srcDir, false, dataDir, { normalizedBases });

    expect(fs.existsSync(path.join(dataDir, "subject-1_data.csv"))).toBe(true);
    expect(fs.existsSync(path.join(dataDir, "subject-trial_data.csv"))).toBe(true);
    expect(fs.existsSync(path.join(dataDir, "trial.csv"))).toBe(false);
  });

  test("skips a non-compliant filename when no normalized base is provided (never invents one)", async () => {
    const srcDir = path.join(tmpDir, "src");
    const dataDir = path.join(tmpDir, "data");
    fs.mkdirSync(srcDir);
    fs.mkdirSync(dataDir);
    fs.writeFileSync(path.join(srcDir, "experiment.json"), JSON.stringify([{ trial_index: 0, rt: 1 }]));
    fs.writeFileSync(path.join(srcDir, "trial.csv"), "trial_type,rt\njsPsych-html-keyboard-response,512");

    const metadata = new JsPsychMetadata();
    const { total, failed } = await processDirectory(metadata, srcDir, false, dataDir);

    // both are non-compliant and unmapped → skipped, not written under an invalid name
    expect(total).toBe(2);
    expect(failed).toBe(2);
    expect(fs.readdirSync(dataDir).filter((f) => f.endsWith(".csv"))).toHaveLength(0);
  });

  test("names extracted-array CSVs from the parent's normalized base", async () => {
    const srcDir = path.join(tmpDir, "src");
    const dataDir = path.join(tmpDir, "data");
    fs.mkdirSync(srcDir);
    fs.mkdirSync(dataDir);
    // a nested array-of-objects column triggers extraction into a separate CSV
    const rows = [
      { trial_index: 0, mouse_tracking: [{ x: 1, y: 2 }, { x: 3, y: 4 }] },
      { trial_index: 1, mouse_tracking: [{ x: 5, y: 6 }] },
    ];
    fs.writeFileSync(path.join(srcDir, "subject-1_data.json"), JSON.stringify(rows));

    const metadata = new JsPsychMetadata();
    await processDirectory(metadata, srcDir, false, dataDir);

    // value is camelCased (no hyphens) and keyed by the unofficial "measure" keyword
    expect(fs.existsSync(path.join(dataDir, "subject-1_measure-mouseTracking_data.csv"))).toBe(true);
  });

  test("analyzeOutputColumns reports each file's extracted sidecar columns without writing", async () => {
    const srcDir = path.join(tmpDir, "src");
    fs.mkdirSync(srcDir);
    const rows = [
      { trial_index: 0, mouse_tracking: [{ x: 1, y: 2 }], rt: 5 },
      { trial_index: 1, mouse_tracking: [{ x: 3, y: 4 }], rt: 6 },
    ];
    fs.writeFileSync(path.join(srcDir, "01.json"), JSON.stringify(rows));

    const columns = await analyzeOutputColumns(srcDir);
    expect(columns).toHaveLength(1);
    expect(columns[0].key).toBe(path.resolve(srcDir, "01.json"));
    expect(columns[0].arrayColumns).toEqual(["mouse_tracking"]);
    expect(columns[0].objectColumns).toEqual([]);
    // Nothing was written.
    expect(fs.readdirSync(srcDir)).toEqual(["01.json"]);
  });

  test("honors a supplied rename plan for the main and sidecar names", async () => {
    const srcDir = path.join(tmpDir, "src");
    const dataDir = path.join(tmpDir, "data");
    fs.mkdirSync(srcDir);
    fs.mkdirSync(dataDir);
    const rows = [
      { trial_index: 0, mouse_tracking: [{ x: 1, y: 2 }] },
      { trial_index: 1, mouse_tracking: [{ x: 3, y: 4 }] },
    ];
    fs.writeFileSync(path.join(srcDir, "raw-export.json"), JSON.stringify(rows));

    const key = path.resolve(srcDir, "raw-export.json");
    const columns = await analyzeOutputColumns(srcDir);
    const normalizedBases = new Map([[key, "subject-7"]]);
    const renamePlan = planRenames(columns.map((c) => ({ key: c.key, base: "subject-7", arrayColumns: c.arrayColumns, objectColumns: c.objectColumns })));

    const { failed } = await processDirectory(new JsPsychMetadata(), srcDir, false, dataDir, { normalizedBases, renamePlan });

    expect(failed).toBe(0);
    const written = fs.readdirSync(dataDir).filter((f) => f.endsWith(".csv")).sort();
    expect(written).toEqual(["subject-7_data.csv", "subject-7_measure-mouseTracking_data.csv"]);
  });

  test("aborts with RenamePlanError when the data produces a column the plan didn't approve", async () => {
    const srcDir = path.join(tmpDir, "src");
    const dataDir = path.join(tmpDir, "data");
    fs.mkdirSync(srcDir);
    fs.mkdirSync(dataDir);
    const rows = [
      { trial_index: 0, mouse_tracking: [{ x: 1, y: 2 }] },
      { trial_index: 1, mouse_tracking: [{ x: 3, y: 4 }] },
    ];
    fs.writeFileSync(path.join(srcDir, "raw-export.json"), JSON.stringify(rows));

    const key = path.resolve(srcDir, "raw-export.json");
    // A plan that knows the main name but NOT the mouse_tracking sidecar (e.g. stale preview).
    const renamePlan = planRenames([{ key, base: "subject-7" }]);
    const normalizedBases = new Map([[key, "subject-7"]]);

    await expect(
      processDirectory(new JsPsychMetadata(), srcDir, false, dataDir, { normalizedBases, renamePlan })
    ).rejects.toThrow(RenamePlanError);
  });

  // #109 finding 2: R's write.csv prepends an unnamed row-index column (header starts with a bare
  // comma). The written CSV must drop it so it matches variableMeasured, on both write paths.
  test("non-planned path drops an unnamed leading column from the written CSV", async () => {
    const srcDir = path.join(tmpDir, "src");
    const dataDir = path.join(tmpDir, "data");
    fs.mkdirSync(srcDir);
    fs.mkdirSync(dataDir);
    fs.writeFileSync(
      path.join(srcDir, "subject-1_data.csv"),
      ",trial_type,rt\n1,jsPsych-html-keyboard-response,450\n2,jsPsych-html-keyboard-response,512",
    );

    const metadata = new JsPsychMetadata();
    await processDirectory(metadata, srcDir, false, dataDir);

    const csv = fs.readFileSync(path.join(dataDir, "subject-1_data.csv"), "utf8");
    const header = csv.split(/\r?\n/)[0].split(",");
    expect(header).not.toContain("");
    expect(header).toEqual(expect.arrayContaining(["trial_type", "rt"]));
    // On-disk header and variableMeasured agree — the whole point.
    const names = (metadata.getMetadata()["variableMeasured"] as any[]).map((v) => v.name);
    for (const col of header) expect(names).toContain(col);
  });

  test("rename-plan path also drops an unnamed leading column", async () => {
    const srcDir = path.join(tmpDir, "src");
    const dataDir = path.join(tmpDir, "data");
    fs.mkdirSync(srcDir);
    fs.mkdirSync(dataDir);
    fs.writeFileSync(
      path.join(srcDir, "raw.csv"),
      ",trial_type,rt\n1,jsPsych-html-keyboard-response,450\n2,jsPsych-html-keyboard-response,512",
    );

    const key = path.resolve(srcDir, "raw.csv");
    const columns = await analyzeOutputColumns(srcDir);
    const normalizedBases = new Map([[key, "subject-9"]]);
    const renamePlan = planRenames(columns.map((c) => ({ key: c.key, base: "subject-9", arrayColumns: c.arrayColumns, objectColumns: c.objectColumns })));

    const { failed } = await processDirectory(new JsPsychMetadata(), srcDir, false, dataDir, { normalizedBases, renamePlan });

    expect(failed).toBe(0);
    const csv = fs.readFileSync(path.join(dataDir, "subject-9_data.csv"), "utf8");
    expect(csv.split(/\r?\n/)[0].split(",")).not.toContain("");
  });

  // Parse-once guard: the file is parsed a single time and the rows (not the raw string) are
  // handed to generate(), so a large file isn't re-parsed for metadata and again for the CSV.
  test("parses each file once: generate() receives parsed rows, not the raw string", async () => {
    const srcDir = path.join(tmpDir, "src");
    const dataDir = path.join(tmpDir, "data");
    fs.mkdirSync(srcDir);
    fs.mkdirSync(dataDir);
    fs.writeFileSync(path.join(srcDir, "subject-1_data.json"), JSON.stringify([{ trial_index: 0, rt: 1 }]));
    fs.writeFileSync(path.join(srcDir, "subject-2_data.csv"), "trial_index,rt\n0,1");

    const metadata = new JsPsychMetadata();
    const generateSpy = jest.spyOn(metadata, "generate"); // keeps the real implementation
    await processDirectory(metadata, srcDir, false, dataDir);

    expect(generateSpy).toHaveBeenCalledTimes(2);
    for (const call of generateSpy.mock.calls) {
      expect(Array.isArray(call[0])).toBe(true);
    }
    generateSpy.mockRestore();
  });
});

// #109 finding #3: a fully-flagged headless run must not block on the interactive join-key prompt.
// resolveJoinKeysNonInteractive picks deterministically from the same analysis the prompt uses.
describe("resolveJoinKeysNonInteractive", () => {
  // Two subjects, trial_index restarts per subject — the classic multi-subject case where the
  // default join key is not unique but subject_id alone resolves it.
  // rt repeats across subjects, so subject_id is the only single column that makes the rows unique.
  const multiSubject = [
    { trial_index: 0, subject_id: "s1", rt: 1 },
    { trial_index: 1, subject_id: "s1", rt: 2 },
    { trial_index: 0, subject_id: "s2", rt: 1 },
    { trial_index: 1, subject_id: "s2", rt: 2 },
  ];

  test("adds a single sufficient column (subject_id) and reports resolved", () => {
    const analysis = analyzeJoinKeys(multiSubject, ["trial_index"]);
    expect(analysis.suggestedAdditionalKeys).toEqual([]); // a single column suffices

    const result = resolveJoinKeysNonInteractive(analysis, ["trial_index"], "response.csv");
    expect(result.keys).toEqual(["trial_index", "subject_id"]);
    expect(result.unresolved).toBe(false);
    expect(result.message).toContain("subject_id");
  });

  test("uses the greedy combination when no single column suffices", () => {
    // Neither session nor block alone makes trial_index unique, but together they do.
    const rows = [
      { trial_index: 0, session: "a", block: 1 },
      { trial_index: 0, session: "a", block: 2 },
      { trial_index: 0, session: "b", block: 1 },
      { trial_index: 0, session: "b", block: 2 },
    ];
    const analysis = analyzeJoinKeys(rows, ["trial_index"]);
    expect(analysis.suggestedAdditionalKeys && analysis.suggestedAdditionalKeys.length).toBeGreaterThan(0);

    const result = resolveJoinKeysNonInteractive(analysis, ["trial_index"], "data.csv");
    expect(result.unresolved).toBe(false);
    expect(new Set(result.keys)).toEqual(new Set(["trial_index", "session", "block"]));
  });

  test("proceeds with a warning when no column can make the rows unique", () => {
    // Genuinely duplicate rows: no candidate column distinguishes them.
    const rows = [
      { trial_index: 0, kind: "x" },
      { trial_index: 0, kind: "x" },
    ];
    const analysis = analyzeJoinKeys(rows, ["trial_index"]);
    expect(analysis.suggestedAdditionalKeys).toBeNull();

    const result = resolveJoinKeysNonInteractive(analysis, ["trial_index"], "dup.csv");
    expect(result.keys).toEqual(["trial_index"]);
    expect(result.unresolved).toBe(true);
    expect(result.message).toMatch(/duplicate/i);
  });

  test("chosen single column is deterministic (stable across equivalent candidates)", () => {
    // Both subject_id and uid alone make the rows unique; the lexicographically first wins.
    const rows = [
      { trial_index: 0, subject_id: "s1", uid: "u1" },
      { trial_index: 0, subject_id: "s2", uid: "u2" },
    ];
    const analysis = analyzeJoinKeys(rows, ["trial_index"]);
    const result = resolveJoinKeysNonInteractive(analysis, ["trial_index"], "data.csv");
    expect(result.keys).toEqual(["trial_index", "subject_id"]); // "subject_id" < "uid"
  });
});

// Some jsPsych exports (e.g. OSF) wrap trials as { "trials": [...] }. The CLI should treat
// these exactly like a bare array: build the main CSV from the unwrapped trials and preserve
// the literal wrapped original under raw/. Wrapper support comes from parseJsonData (which the
// CLI uses at every JSON parse site), so no CLI-specific unwrap step is needed.
describe("{ trials: [...] } wrapper handling", () => {
  test("processDirectory builds the main CSV from unwrapped trials and preserves the wrapped original", async () => {
    const srcDir = path.join(tmpDir, "src");
    const dataDir = path.join(tmpDir, "data");
    fs.mkdirSync(srcDir);
    fs.mkdirSync(dataDir);
    const wrapped = JSON.stringify({
      trials: [
        { trial_type: "jsPsych-html-keyboard-response", trial_index: 0, rt: 450 },
        { trial_type: "jsPsych-html-keyboard-response", trial_index: 1, rt: 512 },
      ],
    });
    fs.writeFileSync(path.join(srcDir, "subj-1_data.json"), wrapped);

    const { total, failed } = await processDirectory(new JsPsychMetadata(), srcDir, false, dataDir);
    expect(total).toBe(1);
    expect(failed).toBe(0);

    // Main CSV built from the unwrapped trials: header + one row per trial.
    const csv = fs.readFileSync(path.join(dataDir, "subj-1_data.csv"), "utf8");
    const rows = csv.trim().split("\n");
    expect(rows.length).toBe(3); // header + 2 trials
    expect(csv).toContain("450");
    expect(csv).toContain("512");

    // The literal wrapped original is preserved byte-for-byte under raw/.
    const raw = fs.readFileSync(path.join(dataDir, "raw", "subj-1_data.json"), "utf8");
    expect(raw).toBe(wrapped);
  });

  test("preAnalyzeDirectory no longer skips a wrapped file (analyzes its trials)", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "subj-1_data.json"),
      JSON.stringify({ trials: [{ trial_index: 0 }, { trial_index: 0 }] })
    );

    const result = await preAnalyzeDirectory(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.fileName).toBe("subj-1_data.json");
    expect(result!.analysis.isUnique).toBe(false);
  });

  test("a { trials: {...} } object (trials not an array) is still skipped", async () => {
    const srcDir = path.join(tmpDir, "src");
    const dataDir = path.join(tmpDir, "data");
    fs.mkdirSync(srcDir);
    fs.mkdirSync(dataDir);
    fs.writeFileSync(path.join(srcDir, "subj-1_data.json"), JSON.stringify({ trials: { a: 1 } }));

    const { total, failed } = await processDirectory(new JsPsychMetadata(), srcDir, false, dataDir);
    expect(total).toBe(1);
    expect(failed).toBe(1);
    expect(fs.existsSync(path.join(dataDir, "subj-1_data.csv"))).toBe(false);
  });
});
