import os from "os";
import path from "path";
import { expandHomeDir } from "../src/utils";
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
