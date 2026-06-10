import os from "os";
import path from "path";
import { objectsToCSV, isValidPsychDSDataFilename, toPsychDSValue, deriveArrayFilename, disambiguateArrayFilename } from "@jspsych/metadata";
import {
  expandHomeDir,
  fileStem,
  disambiguateFilename,
} from "../src/utils";
import { generatePath } from "../src/data";

describe("expandHomeDir", () => {
  test("expands leading ~ to the home directory", () => {
    const result = expandHomeDir("~/documents/data");
    expect(result).toBe(path.join(os.homedir(), "/documents/data"));
  });

  test("returns path unchanged when it does not start with ~", () => {
    const absolute = "/usr/local/data";
    expect(expandHomeDir(absolute)).toBe(absolute);

    const relative = "some/relative/path";
    expect(expandHomeDir(relative)).toBe(relative);
  });

  test("handles bare ~ as the home directory", () => {
    expect(expandHomeDir("~")).toBe(path.join(os.homedir(), ""));
  });
});

describe("generatePath", () => {
  test("returns an absolute path unchanged", () => {
    const absolute = path.resolve("/some/absolute/path");
    expect(generatePath(absolute)).toBe(absolute);
  });

  test("resolves a relative path against the current working directory", () => {
    const relative = "relative/path";
    expect(generatePath(relative)).toBe(path.resolve(process.cwd(), relative));
  });
});

describe("objectsToCSV", () => {
  test("returns an empty string for no rows", () => {
    expect(objectsToCSV([])).toBe("");
  });

  test("places priority columns first, then remaining columns in first-seen order", () => {
    const csv = objectsToCSV([{ rt: 5, trial_index: 0 }], ["trial_index"]);
    expect(csv.split("\r\n")[0]).toBe("trial_index,rt");
  });

  test("serialises nested objects/arrays as JSON, never [object Object]", () => {
    const csv = objectsToCSV([{ trial_index: 0, response: { Q0: "yes" }, tags: ["a", "b"] }], ["trial_index"]);
    expect(csv).not.toContain("[object Object]");
    expect(csv).toContain('{""Q0"":""yes""}'); // escaped JSON object
    expect(csv).toContain('[""a"",""b""]');     // escaped JSON array
  });

  test("escapes commas, quotes, and newlines per RFC 4180", () => {
    const csv = objectsToCSV([{ a: "x,y", b: 'say "hi"', c: "two\nlines" }], []);
    expect(csv).toContain('"x,y"');
    expect(csv).toContain('"say ""hi"""');
    expect(csv).toContain('"two\nlines"');
  });

  test("leaves missing fields as empty cells (header is the union of all keys)", () => {
    const csv = objectsToCSV([{ a: 1, b: 2 }, { a: 3 }], []);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("a,b");
    expect(lines[1]).toBe("1,2");
    expect(lines[2]).toBe("3,");
  });
});

describe("isValidPsychDSDataFilename", () => {
  test("accepts compliant single- and multi-pair names", () => {
    expect(isValidPsychDSDataFilename("study-minimal_data.csv")).toBe(true);
    expect(isValidPsychDSDataFilename("subject-001_session-1_data.csv")).toBe(true);
    expect(isValidPsychDSDataFilename("subject-123a_data.tsv")).toBe(true);
  });

  test("rejects non-compliant names", () => {
    expect(isValidPsychDSDataFilename("subject1_data.csv")).toBe(false);   // no key-value pair
    expect(isValidPsychDSDataFilename("experiment.csv")).toBe(false);      // missing _data
    expect(isValidPsychDSDataFilename("year2024_data.csv")).toBe(false);   // no hyphen
    expect(isValidPsychDSDataFilename("subject-a-b_data.csv")).toBe(false); // hyphen in value
    expect(isValidPsychDSDataFilename("sub1-1_data.csv")).toBe(false);     // digit in keyword
  });
});

describe("toPsychDSValue", () => {
  test("camelCases across non-alphanumeric boundaries", () => {
    expect(toPsychDSValue("mouse_tracking")).toBe("mouseTracking");
    expect(toPsychDSValue("mouse-tracking-data")).toBe("mouseTrackingData");
    expect(toPsychDSValue("My Data")).toBe("MyData");
  });

  test("leaves already-alphanumeric strings intact", () => {
    expect(toPsychDSValue("subject1")).toBe("subject1");
    expect(toPsychDSValue("responseTime")).toBe("responseTime");
  });

  test("returns the fallback when there are no alphanumeric characters", () => {
    expect(toPsychDSValue("___")).toBe("value");
    expect(toPsychDSValue("!!!", "col")).toBe("col");
  });

  test("output is always a valid Psych-DS value segment", () => {
    for (const input of ["mouse_tracking", "RT (ms)", "a-b-c", "x.y.z"]) {
      expect(toPsychDSValue(input)).toMatch(/^[a-zA-Z0-9]+$/);
    }
  });
});

describe("fileStem", () => {
  test("strips extension and a trailing _data", () => {
    expect(fileStem("subject-1_data.csv")).toBe("subject-1");
    expect(fileStem("experiment.json")).toBe("experiment");
    expect(fileStem("trial.csv")).toBe("trial");
  });
});

describe("deriveArrayFilename", () => {
  test("builds a valid name from the parent base and column", () => {
    const name = deriveArrayFilename("subject-subject1", "mouse_tracking");
    expect(name).toBe("subject-subject1_measure-mouseTracking_data.csv");
    expect(isValidPsychDSDataFilename(name)).toBe(true);
  });

  test("coerces hyphenated columns to a valid (hyphen-free) value", () => {
    const name = deriveArrayFilename("study-minimal", "validation-data.pointData");
    expect(isValidPsychDSDataFilename(name)).toBe(true);
  });
});

describe("disambiguateArrayFilename", () => {
  test("returns the name unchanged when free", () => {
    expect(disambiguateArrayFilename("subject-1_data.csv", new Set())).toBe("subject-1_data.csv");
  });

  test("appends a counter to the final value, keeping the name valid", () => {
    const used = new Set(["subject-1_data.csv"]);
    const next = disambiguateArrayFilename("subject-1_data.csv", used);
    expect(next).toBe("subject-12_data.csv");
    expect(isValidPsychDSDataFilename(next)).toBe(true);
  });

  test("skips already-used counters", () => {
    const used = new Set(["x-a_data.csv", "x-a2_data.csv"]);
    expect(disambiguateArrayFilename("x-a_data.csv", used)).toBe("x-a3_data.csv");
  });
});

describe("disambiguateFilename", () => {
  test("returns the name unchanged when free", () => {
    expect(disambiguateFilename("data.json", new Set())).toBe("data.json");
  });

  test("inserts a counter before the extension on collision", () => {
    const used = new Set(["data.json"]);
    expect(disambiguateFilename("data.json", used)).toBe("data2.json");
  });

  test("skips already-used counters", () => {
    const used = new Set(["data.json", "data2.json"]);
    expect(disambiguateFilename("data.json", used)).toBe("data3.json");
  });

  test("handles names without an extension", () => {
    const used = new Set(["README"]);
    expect(disambiguateFilename("README", used)).toBe("README2");
  });
});
