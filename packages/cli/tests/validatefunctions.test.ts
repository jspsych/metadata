import fs from "fs";
import os from "os";
import path from "path";
import { validateDirectory, validateJson, parseMissingFields } from "../src/validatefunctions";

function makeIssues(key: string, files: Array<{ evidence: string }>): Map<string, any> {
  const filesMap = new Map(files.map((f, i) => [`/path${i}`, f]));
  return new Map([[key, { files: filesMap }]]);
}

describe("parseMissingFields", () => {
  test("returns empty array when key is not in issues", () => {
    expect(parseMissingFields(new Map(), "JSON_KEY_REQUIRED")).toEqual([]);
  });

  test("parses a single missing field from one file", () => {
    const issues = makeIssues("JSON_KEY_REQUIRED", [
      { evidence: "metadata object missing fields: [name] as per ..." },
    ]);
    expect(parseMissingFields(issues, "JSON_KEY_REQUIRED")).toEqual(["name"]);
  });

  test("parses multiple missing fields from one file", () => {
    const issues = makeIssues("JSON_KEY_REQUIRED", [
      { evidence: "metadata object missing fields: [name,description,author] as per ..." },
    ]);
    expect(parseMissingFields(issues, "JSON_KEY_REQUIRED")).toEqual(["name", "description", "author"]);
  });

  test("unions fields across multiple files and deduplicates", () => {
    const issues = makeIssues("JSON_KEY_REQUIRED", [
      { evidence: "metadata object missing fields: [name,description] as per ..." },
      { evidence: "metadata object missing fields: [description,author] as per ..." },
    ]);
    expect(parseMissingFields(issues, "JSON_KEY_REQUIRED")).toEqual(["name", "description", "author"]);
  });

  test("returns empty array and warns when evidence is non-empty but unparseable", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const issues = makeIssues("JSON_KEY_REQUIRED", [{ evidence: "unexpected format" }]);
    const result = parseMissingFields(issues, "JSON_KEY_REQUIRED");
    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("could not parse missing fields"));
    warnSpy.mockRestore();
  });

  test("returns empty array silently when evidence is empty", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const issues = makeIssues("JSON_KEY_REQUIRED", [{ evidence: "" }]);
    expect(parseMissingFields(issues, "JSON_KEY_REQUIRED")).toEqual([]);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// Each test suite gets its own temp directory, cleaned up after all tests in the suite.
describe("validateDirectory", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("returns true for an existing directory", async () => {
    expect(await validateDirectory(tmpDir)).toBe(true);
  });

  test("returns false for a path that is a file, not a directory", async () => {
    const filePath = path.join(tmpDir, "notadir.txt");
    fs.writeFileSync(filePath, "hello");
    expect(await validateDirectory(filePath)).toBe(false);
  });

  test("returns false for a non-existent path", async () => {
    expect(await validateDirectory(path.join(tmpDir, "does-not-exist"))).toBe(false);
  });

  test("expands ~ before validating", async () => {
    // os.homedir() is a real directory, so this should return true
    expect(await validateDirectory("~")).toBe(true);
  });
});

describe("validateJson", () => {
  let tmpDir: string;
  let validJsonPath: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"));
    validJsonPath = path.join(tmpDir, "dataset_description.json");
    fs.writeFileSync(validJsonPath, JSON.stringify({ name: "test" }));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("returns true for a valid .json file", () => {
    expect(validateJson(validJsonPath)).toBe(true);
  });

  test("returns true when fileName matches", () => {
    expect(validateJson(validJsonPath, "dataset_description.json")).toBe(true);
  });

  test("returns false when fileName does not match", () => {
    expect(validateJson(validJsonPath, "other.json")).toBe(false);
  });

  test("returns false for a non-existent file", () => {
    expect(validateJson(path.join(tmpDir, "missing.json"))).toBe(false);
  });

  test("returns false for a file without a .json extension", () => {
    const csvPath = path.join(tmpDir, "data.csv");
    fs.writeFileSync(csvPath, "a,b,c");
    expect(validateJson(csvPath)).toBe(false);
  });
});
