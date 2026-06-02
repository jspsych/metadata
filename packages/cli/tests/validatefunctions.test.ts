import fs from "fs";
import os from "os";
import path from "path";
import { validateDirectory, validateJson } from "../src/validatefunctions";

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
