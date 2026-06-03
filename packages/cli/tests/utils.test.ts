import os from "os";
import path from "path";
import {
  expandHomeDir,
  sanitizePsychDSSegment,
  deriveArrayFilename,
  objectsToCSV,
  disambiguateArrayFilename,
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

describe("sanitizePsychDSSegment", () => {
  test("lowercases the input", () => {
    expect(sanitizePsychDSSegment("ResponseKey")).toBe("responsekey");
  });

  test("replaces spaces, underscores, and periods with hyphens", () => {
    expect(sanitizePsychDSSegment("mouse tracking")).toBe("mouse-tracking");
    expect(sanitizePsychDSSegment("mouse_tracking")).toBe("mouse-tracking");
    expect(sanitizePsychDSSegment("validation.pointData")).toBe("validation-pointdata");
  });

  test("collapses runs of replacement characters into a single hyphen", () => {
    expect(sanitizePsychDSSegment("a   b")).toBe("a-b");
    expect(sanitizePsychDSSegment("a___b")).toBe("a-b");
  });

  test("trims leading and trailing hyphens", () => {
    expect(sanitizePsychDSSegment("_leading")).toBe("leading");
    expect(sanitizePsychDSSegment("trailing_")).toBe("trailing");
    expect(sanitizePsychDSSegment("__both__")).toBe("both");
  });

  test("leaves already-safe alphanumeric-hyphen values unchanged", () => {
    expect(sanitizePsychDSSegment("participant-001")).toBe("participant-001");
  });
});

describe("deriveArrayFilename", () => {
  test("strips the extension and trailing _data, then sanitizes both segments", () => {
    // NB: sanitizePsychDSSegment converts the underscore in the stem to a hyphen, so the
    // two keyword-value pairs in the source name collapse into one segment. This diverges
    // from the function's JSDoc example (which shows the underscore preserved) — see issue #8
    // follow-up. This assertion captures the actual current behavior.
    expect(deriveArrayFilename("participant-001_session-1_data.csv", "mouse_tracking_data")).toBe(
      "participant-001-session-1_measure-mouse-tracking-data_data.csv"
    );
  });

  test("sanitizes a source filename with spaces and mixed case", () => {
    expect(deriveArrayFilename("Keyboard Response.csv", "response")).toBe(
      "keyboard-response_measure-response_data.csv"
    );
  });

  test("sanitizes a dotted column name", () => {
    expect(deriveArrayFilename("stem.csv", "validation_data.pointData")).toBe(
      "stem_measure-validation-data-pointdata_data.csv"
    );
  });

  test("strips _data case-insensitively", () => {
    expect(deriveArrayFilename("trial_DATA.json", "col")).toBe("trial_measure-col_data.csv");
  });
});

describe("objectsToCSV", () => {
  test("returns an empty string for no rows", () => {
    expect(objectsToCSV([])).toBe("");
  });

  test("places priority columns first, then remaining columns in first-seen order", () => {
    const rows = [{ rt: 450, trial_index: 0, stimulus: "a" }];
    expect(objectsToCSV(rows)).toBe("trial_index,rt,stimulus\r\n0,450,a");
  });

  test("omits priority columns that are not present in the data", () => {
    const rows = [{ rt: 450 }];
    expect(objectsToCSV(rows)).toBe("rt\r\n450");
  });

  test("unions columns across rows and leaves missing values blank", () => {
    const rows = [{ a: 1 }, { a: 2, b: 3 }];
    expect(objectsToCSV(rows)).toBe("a,b\r\n1,\r\n2,3");
  });

  test("renders null and undefined as empty cells", () => {
    const rows = [{ a: null, b: undefined, c: 0 }];
    expect(objectsToCSV(rows)).toBe("a,b,c\r\n,,0");
  });

  test("quotes and escapes values containing commas, quotes, or newlines (RFC 4180)", () => {
    const rows = [{ a: "x,y", b: 'he said "hi"', c: "line1\nline2" }];
    expect(objectsToCSV(rows)).toBe('a,b,c\r\n"x,y","he said ""hi""","line1\nline2"');
  });

  test("separates rows with CRLF", () => {
    const rows = [{ a: 1 }, { a: 2 }];
    expect(objectsToCSV(rows).split("\r\n")).toEqual(["a", "1", "2"]);
  });

  test("honors a custom priority column list", () => {
    const rows = [{ a: 1, z: 2 }];
    expect(objectsToCSV(rows, ["z"])).toBe("z,a\r\n2,1");
  });
});

describe("disambiguateArrayFilename", () => {
  test("returns the base name unchanged when it is not already used", () => {
    expect(disambiguateArrayFilename("foo_measure-bar_data.csv", new Set())).toBe(
      "foo_measure-bar_data.csv"
    );
  });

  test("inserts a numeric suffix before _data.csv when the base collides", () => {
    const used = new Set(["foo_measure-bar_data.csv"]);
    expect(disambiguateArrayFilename("foo_measure-bar_data.csv", used)).toBe(
      "foo_measure-bar-2_data.csv"
    );
  });

  test("increments the suffix until a free name is found", () => {
    const used = new Set([
      "foo_measure-bar_data.csv",
      "foo_measure-bar-2_data.csv",
      "foo_measure-bar-3_data.csv",
    ]);
    expect(disambiguateArrayFilename("foo_measure-bar_data.csv", used)).toBe(
      "foo_measure-bar-4_data.csv"
    );
  });

  test("falls back to stripping a plain .csv extension when there is no _data.csv suffix", () => {
    const used = new Set(["plain.csv"]);
    expect(disambiguateArrayFilename("plain.csv", used)).toBe("plain-2_data.csv");
  });
});
