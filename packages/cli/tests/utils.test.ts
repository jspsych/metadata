import os from "os";
import path from "path";
import { expandHomeDir, objectsToCSV } from "../src/utils";
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
