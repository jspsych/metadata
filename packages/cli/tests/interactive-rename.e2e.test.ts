import fs from "fs";
import os from "os";
import path from "path";
import { execSync, spawnSync } from "child_process";
import * as pty from "node-pty";
import JsPsychMetadata from "@jspsych/metadata";

/**
 * E2E test of the interactive smart-rename flow (PR #91 review request).
 *
 * The rename loop in resolveFilenameNormalization — strategy menu, preview,
 * apply — is the most stateful code in the CLI and is unreachable from plain
 * unit tests because @inquirer/prompts requires a real TTY. This test spawns
 * the built CLI bundle inside a pseudo-terminal (node-pty), drives a full
 * strategy → preview → apply pass with keystrokes, and asserts the renamed
 * files that land on disk, so regressions in that loop are caught in CI.
 *
 * The non-rename prompts on the way out (metadata customization, unknown
 * descriptions) are answered with their defaults; they have their own logic
 * but are not the subject of this test.
 */

const CLI_ROOT = path.resolve(__dirname, "..");
// The CJS bundle is the package's bin entry — the ESM one cannot be run
// directly by node (the package is "type": "commonjs", so .js means CJS).
const CLI_BUNDLE = path.join(CLI_ROOT, "dist", "cjs", "index.cjs");

const ENTER = "\r";
const DOWN = "\x1b[B";

jest.setTimeout(180_000);

/** Drives the CLI bundle in a pseudo-terminal: wait for prompt text, send keys. */
class CliDriver {
  private term: pty.IPty;
  private buffer = "";
  /** Start of the unconsumed region — waitFor only matches output newer than the last match. */
  private cursor = 0;
  private exit: Promise<number>;

  constructor(args: string[]) {
    this.term = pty.spawn(process.execPath, [CLI_BUNDLE, ...args], {
      name: "xterm-color",
      cols: 120,
      rows: 40,
      cwd: CLI_ROOT,
      env: process.env as Record<string, string>,
    });
    this.term.onData((data) => {
      this.buffer += data;
    });
    this.exit = new Promise((resolve) => {
      this.term.onExit(({ exitCode }) => resolve(exitCode));
    });
  }

  output(): string {
    return this.buffer;
  }

  /** Resolves when `text` appears in output newer than the previous match. */
  async waitFor(text: string, timeoutMs = 60_000): Promise<void> {
    const start = Date.now();
    for (;;) {
      const index = this.buffer.indexOf(text, this.cursor);
      if (index !== -1) {
        this.cursor = index + text.length;
        return;
      }
      if (Date.now() - start > timeoutMs) {
        throw new Error(
          `Timed out after ${timeoutMs}ms waiting for ${JSON.stringify(text)}.\n` +
            `--- terminal output ---\n${this.buffer}`
        );
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  /** Sends keystrokes after a short settle so inquirer is listening. */
  async send(keys: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 150));
    this.term.write(keys);
  }

  waitForExit(): Promise<number> {
    return this.exit;
  }

  kill(): void {
    this.term.kill();
  }
}

describe("interactive rename flow (pty E2E)", () => {
  let tmpDir: string;
  let projectDir: string;
  let dataDir: string;
  let cli: CliDriver | undefined;

  beforeAll(() => {
    // The Test CI job runs `npm ci && npm test` without a build step;
    // @jspsych/metadata's dist exists via its prepare script, but the CLI
    // bundle has to be produced here (esbuild only — takes about a second).
    execSync("npm run build", { cwd: CLI_ROOT, stdio: "ignore" });

    // npm strips the execute bit from node-pty's prebuilt macOS spawn-helper
    // (microsoft/node-pty: "posix_spawnp failed"); restore it so the test runs
    // on contributor Macs. Linux (CI) doesn't use spawn-helper.
    const prebuilds = path.join(require.resolve("node-pty"), "..", "..", "prebuilds");
    for (const dir of ["darwin-arm64", "darwin-x64"]) {
      const helper = path.join(prebuilds, dir, "spawn-helper");
      if (fs.existsSync(helper)) fs.chmodSync(helper, 0o755);
    }
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-pty-test-"));

    // Existing Psych-DS project (so --psych-ds-dir skips the project prompts).
    projectDir = path.join(tmpDir, "project");
    fs.mkdirSync(path.join(projectDir, "data"), { recursive: true });
    const metadata = new JsPsychMetadata();
    metadata.setMetadataField("name", "interactive-e2e");
    metadata.setMetadataField("description", "Fixture project for the pty rename-flow test.");
    fs.writeFileSync(
      path.join(projectDir, "dataset_description.json"),
      JSON.stringify(metadata.getMetadata(), null, 2)
    );

    // Source data: two non-compliant filenames whose contents carry a
    // subject_id with exactly one unique value per file, so the data-id
    // strategy is offered (and recommended, i.e. first in the menu). Each trial
    // also carries an array-of-objects column (mouse_tracking) that is extracted
    // to a sidecar CSV — so the preview must show, and the writer must produce,
    // that sidecar under the renamed base.
    const rows = (id: string) => [
      { trial_type: "jsPsych-html-keyboard-response", trial_index: 0, time_elapsed: 500, rt: 450, subject_id: id, mouse_tracking: [{ x: 1, y: 2 }, { x: 3, y: 4 }] },
      { trial_type: "jsPsych-html-keyboard-response", trial_index: 1, time_elapsed: 1000, rt: 512, subject_id: id, mouse_tracking: [{ x: 5, y: 6 }] },
    ];
    dataDir = path.join(tmpDir, "source");
    fs.mkdirSync(dataDir);
    fs.writeFileSync(path.join(dataDir, "01.json"), JSON.stringify(rows("P01")));
    fs.writeFileSync(path.join(dataDir, "02.json"), JSON.stringify(rows("P02")));
  });

  afterEach(() => {
    cli?.kill();
    cli = undefined;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("data-id strategy → preview → apply renames the files it previewed", async () => {
    cli = new CliDriver(["--psych-ds-dir", projectDir, "--data-dir", dataDir]);

    // Pre-pass detects the non-compliant names and scans for ID columns.
    await cli.waitFor("2 data file(s) do not follow the Psych-DS naming pattern");
    await cli.waitFor("Scanning 2 data file(s) for identifier columns");

    // Strategy menu: the data-id strategy is offered and recommended (first),
    // so Enter selects it.
    await cli.waitFor("How should these files be renamed?");
    await cli.waitFor('Use the "subject_id" value found inside each file');
    await cli.send(ENTER);

    // Preview shows the exact old → new mapping, including the extracted sidecar
    // each file will produce, with no collision flags.
    await cli.waitFor("Proposed renames:");
    await cli.waitFor("01.json → subject-P01_data.csv");
    await cli.waitFor('+ subject-P01_measure-mouseTracking_data.csv  (array column "mouse_tracking")');
    await cli.waitFor("02.json → subject-P02_data.csv");
    await cli.waitFor('+ subject-P02_measure-mouseTracking_data.csv  (array column "mouse_tracking")');

    // Apply is the first choice.
    await cli.waitFor("Apply these names?");
    await cli.send(ENTER);

    // Remaining prompts are answered with defaults: metadata customization
    // ("Use defaults" is first), then unknown variable descriptions ("Skip"
    // is second — rt and subject_id have no plugin-supplied description).
    await cli.waitFor("Would you like to customize the metadata?");
    await cli.send(ENTER);
    await cli.waitFor("have unknown descriptions");
    await cli.send(DOWN + ENTER);

    const exitCode = await cli.waitForExit();
    expect(exitCode).toBe(0);

    // The names the user approved in the preview — mains AND sidecars — are the names on disk.
    const written = fs.readdirSync(path.join(projectDir, "data")).sort();
    expect(written).toContain("subject-P01_data.csv");
    expect(written).toContain("subject-P02_data.csv");
    expect(written).toContain("subject-P01_measure-mouseTracking_data.csv");
    expect(written).toContain("subject-P02_measure-mouseTracking_data.csv");
    expect(written.filter((f) => f.endsWith(".csv"))).toHaveLength(4);

    // Originals are preserved under data/raw/ with their old names.
    const raw = fs.readdirSync(path.join(projectDir, "data", "raw")).sort();
    expect(raw).toEqual(["01.json", "02.json"]);

    // The regenerated metadata covers the renamed files' columns.
    const description = JSON.parse(
      fs.readFileSync(path.join(projectDir, "dataset_description.json"), "utf8")
    );
    const variableNames = description.variableMeasured.map((v: { name: string }) => v.name);
    expect(variableNames).toContain("subject_id");
    expect(variableNames).toContain("rt");
  });
});

/**
 * Headless E2E (#109 finding #3 + the non-interactive hardening). Runs the built CLI bundle with
 * piped stdio — so no prompt can succeed — and asserts it never blocks on `✘ User force closed the
 * prompt`. The fixture uses a compliant filename (no rename prompt) and multi-subject data where
 * trial_index restarts per subject (so the join-key path triggers and must resolve deterministically).
 * time_elapsed is included so the data validates on this branch, which predates the lazy-system-
 * variable fix.
 */
describe("non-interactive run (headless, no pty)", () => {
  let tmpDir: string;
  let projectDir: string;
  let dataDir: string;
  let optionsPath: string;

  beforeAll(() => {
    execSync("npm run build", { cwd: CLI_ROOT, stdio: "ignore" });
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-headless-test-"));

    projectDir = path.join(tmpDir, "project");
    fs.mkdirSync(path.join(projectDir, "data"), { recursive: true });
    const metadata = new JsPsychMetadata();
    metadata.setMetadataField("name", "headless-e2e");
    metadata.setMetadataField("description", "Fixture project for the headless run test.");
    fs.writeFileSync(
      path.join(projectDir, "dataset_description.json"),
      JSON.stringify(metadata.getMetadata(), null, 2)
    );

    // Compliant filename → no rename prompt. trial_index restarts per subject → not unique →
    // join-key resolution must kick in. time_elapsed and rt repeat across subjects, so subject_id
    // is the only single column that makes the rows unique (a deterministic, predictable pick).
    dataDir = path.join(tmpDir, "source");
    fs.mkdirSync(dataDir);
    fs.writeFileSync(
      path.join(dataDir, "task-resp_data.csv"),
      [
        "subject_id,trial_type,trial_index,time_elapsed,rt",
        "P01,html-keyboard-response,0,500,450",
        "P01,html-keyboard-response,1,1000,512",
        "P02,html-keyboard-response,0,500,450",
        "P02,html-keyboard-response,1,1000,512",
      ].join("\n")
    );

    optionsPath = path.join(tmpDir, "options.json");
    fs.writeFileSync(
      optionsPath,
      JSON.stringify({ name: "headless-e2e", description: "Headless run test.", author: [{ name: "Test Author" }] })
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /** Spawn the CLI bundle with piped (non-TTY) stdio and an empty stdin. */
  function runHeadless(args: string[]) {
    const res = spawnSync(process.execPath, [CLI_BUNDLE, ...args], {
      cwd: CLI_ROOT,
      input: "",
      encoding: "utf8",
      env: process.env as Record<string, string>,
    });
    return { status: res.status, output: (res.stdout ?? "") + (res.stderr ?? "") };
  }

  test("fully-flagged run resolves join keys without ever prompting", () => {
    const { status, output } = runHeadless([
      "--psych-ds-dir", projectDir,
      "--data-dir", dataDir,
      "--metadata-options", optionsPath,
    ]);

    expect(output).not.toContain("User force closed the prompt");
    expect(output).toContain('added "subject_id"');
    expect(status).toBe(0);
  });

  test("missing --metadata-options falls back to defaults instead of force-closing", () => {
    const { status, output } = runHeadless([
      "--psych-ds-dir", projectDir,
      "--data-dir", dataDir,
    ]);

    expect(output).not.toContain("User force closed the prompt");
    expect(output).toContain("using generated defaults");
    expect(status).toBe(0);
  });
});
