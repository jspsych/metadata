import fs from "fs";
import os from "os";
import path from "path";
import JsPsychMetadata from "@jspsych/metadata";
import { processOptions, loadMetadata, saveTextToPath, processDirectory } from "../src/data";

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

    const metadata = new JsPsychMetadata();
    await processDirectory(metadata, srcDir, false, dataDir);

    const csvPath = path.join(dataDir, "experiment.csv");
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

  test("skips a second same-named JSON file instead of silently overwriting", async () => {
    const srcDir = path.join(tmpDir, "src");
    const dataDir = path.join(tmpDir, "data");
    fs.mkdirSync(path.join(srcDir, "a"), { recursive: true });
    fs.mkdirSync(path.join(srcDir, "b"), { recursive: true });
    fs.mkdirSync(dataDir);
    fs.writeFileSync(path.join(srcDir, "a", "data.json"), JSON.stringify([{ trial_index: 0, rt: 1 }]));
    fs.writeFileSync(path.join(srcDir, "b", "data.json"), JSON.stringify([{ trial_index: 0, rt: 2 }]));

    const metadata = new JsPsychMetadata();
    const { total, failed } = await processDirectory(metadata, srcDir, false, dataDir);

    expect(total).toBe(2);
    expect(failed).toBe(1); // the colliding second file is skipped, not overwritten
    expect(fs.existsSync(path.join(dataDir, "data.csv"))).toBe(true);
  });
});
