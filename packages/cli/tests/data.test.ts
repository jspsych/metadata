import fs from "fs";
import os from "os";
import path from "path";
import JsPsychMetadata from "@jspsych/metadata";
import { processOptions, loadMetadata, saveTextToPath, processDirectory, preAnalyzeDirectory } from "../src/data";

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
