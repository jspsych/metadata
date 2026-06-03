import fs from "fs";
import os from "os";
import path from "path";
import { validateDirectory, validateJson } from "../src/validatefunctions";
import type { validatePsychDS as ValidatePsychDSType } from "../src/validatefunctions";

// Each test suite gets its own temp directory, cleaned up after all tests in the suite.
function makeResult(issues: Array<{ severity: string; key: string; reason: string }>) {
  return { issues: new Map(issues.map((issue, i) => [String(i), issue])) };
}

describe("validatePsychDS", () => {
  let validatePsychDS: typeof ValidatePsychDSType;
  let mockValidate: jest.Mock;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    mockValidate = jest.fn();
    jest.doMock("psychds-validator", () => ({ validate: mockValidate }));
    ({ validatePsychDS } = require("../src/validatefunctions"));
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("prints ✔ line when validation passes with no warnings", async () => {
    mockValidate.mockResolvedValue(makeResult([]));
    await validatePsychDS("/some/dataset", false);
    expect(mockValidate).toHaveBeenCalledWith(path.relative(process.cwd(), "/some/dataset"));
    expect(logSpy).toHaveBeenCalledWith("\n✔ Psych-DS validation passed (0 warnings).");
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  test("prints ✘ line and each error when errors are present", async () => {
    mockValidate.mockResolvedValue(makeResult([
      { severity: "error", key: "MISSING_FIELD", reason: "field is required" },
    ]));
    await validatePsychDS("/some/dataset", false);
    expect(logSpy).toHaveBeenCalledWith("\n✘ Psych-DS validation failed: 1 error, 0 warnings.\n");
    expect(logSpy).toHaveBeenCalledWith("  Error 1: MISSING_FIELD: field is required");
  });

  test("prints rerun hint when warnings are present and verbose is false", async () => {
    mockValidate.mockResolvedValue(makeResult([
      { severity: "warning", key: "OPTIONAL_MISSING", reason: "optional field absent" },
    ]));
    await validatePsychDS("/some/dataset", false);
    expect(logSpy).toHaveBeenCalledWith("\n✔ Psych-DS validation passed (1 warning).");
    expect(logSpy).toHaveBeenCalledWith("  (Rerun with --verbose to see warnings.)");
  });

  test("prints each warning when warnings are present and verbose is true", async () => {
    mockValidate.mockResolvedValue(makeResult([
      { severity: "warning", key: "OPTIONAL_MISSING", reason: "optional field absent" },
    ]));
    await validatePsychDS("/some/dataset", true);
    expect(logSpy).toHaveBeenCalledWith("\n✔ Psych-DS validation passed (1 warning).");
    expect(logSpy).toHaveBeenCalledWith();  // blank separator line
    expect(logSpy).toHaveBeenCalledWith("  Warning 1: OPTIONAL_MISSING: optional field absent");
    expect(logSpy).toHaveBeenCalledTimes(3);
  });

  test("prints errors and warnings when both are present and verbose is true", async () => {
    mockValidate.mockResolvedValue(makeResult([
      { severity: "error", key: "MISSING_FIELD", reason: "field is required" },
      { severity: "warning", key: "OPTIONAL_MISSING", reason: "optional field absent" },
    ]));
    await validatePsychDS("/some/dataset", true);
    expect(logSpy).toHaveBeenCalledWith("\n✘ Psych-DS validation failed: 1 error, 1 warning.\n");
    expect(logSpy).toHaveBeenCalledWith("  Error 1: MISSING_FIELD: field is required");
    expect(logSpy).toHaveBeenCalledWith();  // blank separator line
    expect(logSpy).toHaveBeenCalledWith("  Warning 1: OPTIONAL_MISSING: optional field absent");
    expect(logSpy).toHaveBeenCalledTimes(4);
  });

  test("uses correct plurals with multiple errors and warnings", async () => {
    mockValidate.mockResolvedValue(makeResult([
      { severity: "error", key: "ERR1", reason: "reason one" },
      { severity: "error", key: "ERR2", reason: "reason two" },
      { severity: "warning", key: "WARN1", reason: "warn reason" },
    ]));
    await validatePsychDS("/some/dataset", false);
    expect(logSpy).toHaveBeenCalledWith("\n✘ Psych-DS validation failed: 2 errors, 1 warning.\n");
    expect(logSpy).toHaveBeenCalledWith("  Error 1: ERR1: reason one");
    expect(logSpy).toHaveBeenCalledWith("  Error 2: ERR2: reason two");
  });

  test("prints console.warn and returns without crashing when validate throws", async () => {
    mockValidate.mockRejectedValue(new Error("validator failed"));
    await expect(validatePsychDS("/some/dataset", false)).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      "\nWarning: Psych-DS validation could not run: validator failed"
    );
    expect(logSpy).not.toHaveBeenCalled();
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
