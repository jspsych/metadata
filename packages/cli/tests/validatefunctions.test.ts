import fs from "fs";
import os from "os";
import path from "path";
import { validateDirectory, validateJson, parseMissingFields } from "../src/validatefunctions";
import type { validatePsychDS as ValidatePsychDSType } from "../src/validatefunctions";

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
function makeResult(issues: Array<{ severity: string; key: string; reason: string }>) {
  return { issues: new Map(issues.map((issue, i) => [String(i), issue])) };
}

describe("validatePsychDS", () => {
  let validatePsychDS: typeof ValidatePsychDSType;
  let mockValidate: jest.Mock;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    mockValidate = jest.fn();
    jest.doMock("psychds-validator", () => ({ validate: mockValidate }));
    ({ validatePsychDS } = require("../src/validatefunctions"));
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("prints ✔ line when validation passes with no warnings", async () => {
    mockValidate.mockResolvedValue(makeResult([]));
    const result = await validatePsychDS("/some/dataset", false);
    expect(mockValidate).toHaveBeenCalledWith(path.relative(process.cwd(), "/some/dataset"));
    expect(logSpy).toHaveBeenCalledWith("\n✔ Psych-DS validation passed (0 warnings).");
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ hasErrors: false, missingRequiredFields: [], missingRecommendedFields: [] });
  });

  test("prints ✘ line and each error when errors are present", async () => {
    mockValidate.mockResolvedValue(makeResult([
      { severity: "error", key: "MISSING_FIELD", reason: "field is required" },
    ]));
    const result = await validatePsychDS("/some/dataset", false);
    expect(errorSpy).toHaveBeenCalledWith("\n✘ Psych-DS validation failed: 1 error, 0 warnings.\n");
    expect(errorSpy).toHaveBeenCalledWith("  Error 1: MISSING_FIELD: field is required");
    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ hasErrors: true, missingRequiredFields: [], missingRecommendedFields: [] });
  });

  test("suppresses warning details but shows rerun hint when errors and warnings are present and verbose is false", async () => {
    mockValidate.mockResolvedValue(makeResult([
      { severity: "error", key: "MISSING_FIELD", reason: "field is required" },
      { severity: "warning", key: "OPTIONAL_MISSING", reason: "optional field absent" },
    ]));
    const result = await validatePsychDS("/some/dataset", false);
    expect(errorSpy).toHaveBeenCalledWith("\n✘ Psych-DS validation failed: 1 error, 1 warning.\n");
    expect(errorSpy).toHaveBeenCalledWith("  Error 1: MISSING_FIELD: field is required");
    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith("  (Rerun with --verbose to see warnings.)");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ hasErrors: true, missingRequiredFields: [], missingRecommendedFields: [] });
  });

  test("prints rerun hint when warnings are present and verbose is false", async () => {
    mockValidate.mockResolvedValue(makeResult([
      { severity: "warning", key: "OPTIONAL_MISSING", reason: "optional field absent" },
    ]));
    const result = await validatePsychDS("/some/dataset", false);
    expect(logSpy).toHaveBeenCalledWith("\n✔ Psych-DS validation passed (1 warning).");
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith("  (Rerun with --verbose to see warnings.)");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ hasErrors: false, missingRequiredFields: [], missingRecommendedFields: [] });
  });

  test("prints each warning when warnings are present and verbose is true", async () => {
    mockValidate.mockResolvedValue(makeResult([
      { severity: "warning", key: "OPTIONAL_MISSING", reason: "optional field absent" },
    ]));
    await validatePsychDS("/some/dataset", true);
    expect(logSpy).toHaveBeenCalledWith("\n✔ Psych-DS validation passed (1 warning).");
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith();  // blank separator line
    expect(warnSpy).toHaveBeenCalledWith("  Warning 1: OPTIONAL_MISSING: optional field absent");
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  test("prints errors and warnings when both are present and verbose is true", async () => {
    mockValidate.mockResolvedValue(makeResult([
      { severity: "error", key: "MISSING_FIELD", reason: "field is required" },
      { severity: "warning", key: "OPTIONAL_MISSING", reason: "optional field absent" },
    ]));
    await validatePsychDS("/some/dataset", true);
    expect(errorSpy).toHaveBeenCalledWith("\n✘ Psych-DS validation failed: 1 error, 1 warning.\n");
    expect(errorSpy).toHaveBeenCalledWith("  Error 1: MISSING_FIELD: field is required");
    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith();  // blank separator line
    expect(warnSpy).toHaveBeenCalledWith("  Warning 1: OPTIONAL_MISSING: optional field absent");
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).not.toHaveBeenCalled();
  });

  test("uses correct plurals with multiple errors and 1 warning", async () => {
    mockValidate.mockResolvedValue(makeResult([
      { severity: "error", key: "ERR1", reason: "reason one" },
      { severity: "error", key: "ERR2", reason: "reason two" },
      { severity: "warning", key: "WARN1", reason: "warn reason" },
    ]));
    await validatePsychDS("/some/dataset", false);
    expect(errorSpy).toHaveBeenCalledWith("\n✘ Psych-DS validation failed: 2 errors, 1 warning.\n");
    expect(errorSpy).toHaveBeenCalledWith("  Error 1: ERR1: reason one");
    expect(errorSpy).toHaveBeenCalledWith("  Error 2: ERR2: reason two");
    expect(errorSpy).toHaveBeenCalledTimes(3);
    expect(warnSpy).toHaveBeenCalledWith("  (Rerun with --verbose to see warnings.)");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
  });

  test("uses correct plural for multiple warnings", async () => {
    mockValidate.mockResolvedValue(makeResult([
      { severity: "warning", key: "WARN1", reason: "warn one" },
      { severity: "warning", key: "WARN2", reason: "warn two" },
    ]));
    await validatePsychDS("/some/dataset", false);
    expect(logSpy).toHaveBeenCalledWith("\n✔ Psych-DS validation passed (2 warnings).");
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith("  (Rerun with --verbose to see warnings.)");
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  test("prints console.warn and returns without crashing when validate throws an Error", async () => {
    mockValidate.mockRejectedValue(new Error("validator failed"));
    await expect(validatePsychDS("/some/dataset", false)).resolves.toEqual({
      hasErrors: false,
      missingRequiredFields: [],
      missingRecommendedFields: [],
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "\nWarning: Psych-DS validation could not run: validator failed"
    );
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test("prints the thrown value directly when validate throws a non-Error", async () => {
    mockValidate.mockRejectedValue("something went wrong");
    await expect(validatePsychDS("/some/dataset", false)).resolves.toEqual({
      hasErrors: false,
      missingRequiredFields: [],
      missingRecommendedFields: [],
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "\nWarning: Psych-DS validation could not run: something went wrong"
    );
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

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
