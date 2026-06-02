import fs from "fs";
import os from "os";
import path from "path";
import { createDirectoryWithStructure } from "../src/handlefiles";

describe("createDirectoryWithStructure", () => {
  let tmpBase: string;
  let targetDir: string;

  beforeAll(() => {
    tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "cli-handlefiles-test-"));
    targetDir = path.join(tmpBase, "my-project");
    createDirectoryWithStructure(targetDir);
  });

  afterAll(() => {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  });

  test("creates the root directory", () => {
    expect(fs.existsSync(targetDir)).toBe(true);
    expect(fs.statSync(targetDir).isDirectory()).toBe(true);
  });

  test("creates a data/ subdirectory", () => {
    const dataDir = path.join(targetDir, "data");
    expect(fs.existsSync(dataDir)).toBe(true);
    expect(fs.statSync(dataDir).isDirectory()).toBe(true);
  });

  test("creates README.md with expected content", () => {
    const readmePath = path.join(targetDir, "README.md");
    expect(fs.existsSync(readmePath)).toBe(true);
    const content = fs.readFileSync(readmePath, "utf8");
    expect(content).toBe(
      "# My Project\nHuman-readable description of the project and dataset."
    );
  });

  test("creates CHANGES.md with expected content", () => {
    const changesPath = path.join(targetDir, "CHANGES.md");
    expect(fs.existsSync(changesPath)).toBe(true);
    const content = fs.readFileSync(changesPath, "utf8");
    expect(content).toContain("version tracking");
  });

  test("creates intermediate directories that do not exist yet", () => {
    const nested = path.join(tmpBase, "level1", "level2", "my-project");
    createDirectoryWithStructure(nested);
    expect(fs.existsSync(nested)).toBe(true);
    expect(fs.statSync(nested).isDirectory()).toBe(true);
    expect(fs.existsSync(path.join(nested, "data"))).toBe(true);
    expect(fs.existsSync(path.join(nested, "README.md"))).toBe(true);
    expect(fs.existsSync(path.join(nested, "CHANGES.md"))).toBe(true);
  });
});
