import fs from "fs";
import os from "os";
import path from "path";
import JsPsychMetadata, { stripUnnamedColumns } from "@jspsych/metadata";
import { processOptions, loadMetadata, saveTextToPath, processDirectory, preAnalyzeDirectory, enumerateDataFiles, analyzeOutputColumns, RenamePlanError } from "../src/data";
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

  // #109 finding 2: R's write.csv prepends an unnamed row-index column (header starts with a
  // bare comma). generate() drops it from variableMeasured, so the written CSV must drop it too
  // or the dataset fails validation with CSV_COLUMN_MISSING_FROM_METADATA.
  test("drops an unnamed leading column from the written CSV so it matches variableMeasured", async () => {
    const srcDir = path.join(tmpDir, "src");
    const dataDir = path.join(tmpDir, "data");
    fs.mkdirSync(srcDir);
    fs.mkdirSync(dataDir);
    // Leading bare comma => empty-string header, exactly as R's write.csv(row.names=TRUE) emits.
    fs.writeFileSync(
      path.join(srcDir, "subject-1_data.csv"),
      ",trial_type,rt\n1,jsPsych-html-keyboard-response,450\n2,jsPsych-html-keyboard-response,512",
    );

    const metadata = new JsPsychMetadata();
    await processDirectory(metadata, srcDir, false, dataDir);

    const csv = fs.readFileSync(path.join(dataDir, "subject-1_data.csv"), "utf8");
    const header = csv.split(/\r?\n/)[0].split(",");
    // No empty column name survives, and the real columns remain.
    expect(header).not.toContain("");
    expect(header).toEqual(expect.arrayContaining(["trial_type", "rt"]));

    // The on-disk header and variableMeasured agree (the whole point — a validating dataset).
    const names = (metadata.getMetadata()["variableMeasured"] as any[]).map((v) => v.name);
    for (const col of header) expect(names).toContain(col);
  });

  test("copies a well-formed CSV byte-for-byte (no unnamed columns to drop)", async () => {
    const srcDir = path.join(tmpDir, "src");
    const dataDir = path.join(tmpDir, "data");
    fs.mkdirSync(srcDir);
    fs.mkdirSync(dataDir);
    const original = "trial_type,rt\njsPsych-html-keyboard-response,450\njsPsych-html-keyboard-response,512";
    fs.writeFileSync(path.join(srcDir, "subject-1_data.csv"), original);

    await processDirectory(new JsPsychMetadata(), srcDir, false, dataDir);

    expect(fs.readFileSync(path.join(dataDir, "subject-1_data.csv"), "utf8")).toBe(original);
  });
});

describe("stripUnnamedColumns", () => {
  test("removes empty and whitespace-only keys from every row and reports them", () => {
    const rows = [
      { "": "1", " ": "x", trial_index: 0, rt: 200 },
      { "": "2", " ": "y", trial_index: 1, rt: 350 },
    ];
    const { rows: out, dropped } = stripUnnamedColumns(rows);
    expect(dropped.sort()).toEqual(["", " "]);
    expect(out).toBe(rows); // mutates in place, returns same reference
    expect(Object.keys(out[0])).toEqual(["trial_index", "rt"]);
  });

  test("is a no-op (empty dropped list) when all columns are named", () => {
    const rows = [{ trial_index: 0, rt: 200 }];
    const { dropped } = stripUnnamedColumns(rows);
    expect(dropped).toEqual([]);
    expect(Object.keys(rows[0])).toEqual(["trial_index", "rt"]);
  });
});
