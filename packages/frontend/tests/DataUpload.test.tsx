import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JSZip from "jszip";
import { analyzeJoinKeys } from "@jspsych/metadata";
import DataUpload, { emptyDataSession } from "../src/pages/DataUpload";
import type { DataSession } from "../src/pages/DataUpload";

jest.mock("@jspsych/metadata", () => ({
  __esModule: true,
  default: jest.fn(),
  analyzeJoinKeys: jest.fn(),
  // Preflight parses JSON via parseJsonData (tagSourceRecordId is a no-op for a single array);
  // return the parsed array so the join-key preflight runs. runGenerate then builds Psych-DS
  // files, which the component only iterates over — an empty list is sufficient for these tests.
  parseJsonData: jest.fn((content: string) => JSON.parse(content)),
  parseCSV: jest.fn(() => []),
  hasUnnamedColumns: jest.fn(() => false),
  buildPsychDSDataFiles: jest.fn(() => []),
  deriveFallbackBase: jest.fn((stem: string) => `subject-${stem}`),
  isValidPsychDSDataFilename: jest.fn(() => false),
  PSYCHDS_IGNORE_FILENAME: ".psychds-ignore",
  PSYCHDS_IGNORE_CONTENT: "",
}));

jest.mock("jszip", () => ({
  __esModule: true,
  default: { loadAsync: jest.fn() },
}));

const mockAnalyzeJoinKeys = analyzeJoinKeys as jest.Mock;
const mockLoadAsync = (JSZip as { loadAsync: jest.Mock }).loadAsync;

function makeFile(name: string, content = "col,val\n1,2", relativePath = "") {
  const file = new File([content], name);
  Object.defineProperty(file, "webkitRelativePath", { value: relativePath, configurable: true });
  return file;
}

function makeMeta(varNames: string[] = []) {
  return {
    generate: jest.fn().mockResolvedValue(undefined),
    getVariableNames: jest.fn().mockReturnValue(varNames),
    // runGenerate feeds these into buildPsychDSDataFiles when converting each file.
    getExtractedArrays: jest.fn().mockReturnValue(new Map()),
    getExtractedObjects: jest.fn().mockReturnValue(new Map()),
    getArrayJoinKeys: jest.fn().mockReturnValue(["trial_index"]),
  } as any;
}

let meta: ReturnType<typeof makeMeta>;
let onComplete: jest.Mock;
let onSessionChange: jest.Mock;

function props(overrides: Record<string, unknown> = {}) {
  return {
    jsPsychMetadata: meta,
    dataProcessed: false,
    onComplete,
    session: emptyDataSession,
    onSessionChange,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAnalyzeJoinKeys.mockReturnValue({ isUnique: true, candidates: [] });
  meta = makeMeta();
  onComplete = jest.fn();
  onSessionChange = jest.fn();
});

describe("DataUpload", () => {
  // ── idle ────────────────────────────────────────────────────────────────

  describe("idle phase", () => {
    test("renders description and picker buttons", () => {
      render(<DataUpload {...props()} />);
      expect(screen.getByText(/Select your data folder/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Choose folder" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Upload .zip" })).toBeInTheDocument();
    });

    test("Process button is absent until files are picked", () => {
      render(<DataUpload {...props()} />);
      expect(screen.queryByRole("button", { name: "Process files" })).not.toBeInTheDocument();
    });
  });

  // ── fromExisting ─────────────────────────────────────────────────────────

  describe("fromExisting phase", () => {
    test("shows variables-loaded banner, optional-upload note, and Continue", () => {
      render(<DataUpload {...props({ existingMetadataLoaded: true })} />);
      expect(screen.getByText(/Variables loaded from existing metadata/)).toBeInTheDocument();
      expect(screen.getByText(/No data upload is needed/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Continue →" })).toBeInTheDocument();
    });

    test("Continue calls onComplete", async () => {
      render(<DataUpload {...props({ existingMetadataLoaded: true })} />);
      await userEvent.click(screen.getByRole("button", { name: "Continue →" }));
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    test("picking files from fromExisting transitions to ready with Process button", () => {
      const { container } = render(<DataUpload {...props({ existingMetadataLoaded: true })} />);
      const input = container.querySelector("input[multiple]") as HTMLInputElement;
      fireEvent.change(input, { target: { files: [makeFile("sub01.csv")] } });

      expect(screen.getByRole("button", { name: "Process files" })).toBeInTheDocument();
      expect(screen.queryByText(/Variables loaded from existing metadata/)).not.toBeInTheDocument();
    });
  });

  // ── hasData ──────────────────────────────────────────────────────────────

  describe("hasData phase (navigating back)", () => {
    test("shows variable count and Continue button", () => {
      render(<DataUpload {...props({ jsPsychMetadata: makeMeta(["rt", "stimulus"]), dataProcessed: true })} />);
      expect(screen.getByText(/Data already processed/)).toBeInTheDocument();
      expect(screen.getByText(/2 variables generated/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Continue →" })).toBeInTheDocument();
    });

    test("uses singular form for 1 variable", () => {
      render(<DataUpload {...props({ jsPsychMetadata: makeMeta(["rt"]), dataProcessed: true })} />);
      expect(screen.getByText(/1 variable generated/)).toBeInTheDocument();
    });

    test("shows file status list from session", () => {
      const session: DataSession = {
        ...emptyDataSession,
        fileStatuses: [
          { name: "sub01.csv", status: "success" },
          { name: "sub02.csv", status: "error", detail: "parse failed" },
        ],
      };
      render(<DataUpload {...props({ dataProcessed: true, session })} />);
      expect(screen.getByText("sub01.csv")).toBeInTheDocument();
      expect(screen.getByText("parse failed")).toBeInTheDocument();
    });

    test("shows Re-configure join keys when candidates and files exist", () => {
      const session: DataSession = {
        ...emptyDataSession,
        joinKeyCandidates: [{ column: "subject", makesUnique: true }],
        files: [makeFile("data.json", "[]")],
      };
      render(<DataUpload {...props({ dataProcessed: true, session })} />);
      expect(screen.getByRole("button", { name: "Re-configure join keys" })).toBeInTheDocument();
    });
  });

  // ── folder picking ───────────────────────────────────────────────────────

  describe("folder picking", () => {
    test("picked files appear in file list with Process button", () => {
      const { container } = render(<DataUpload {...props()} />);
      const input = container.querySelector("input[multiple]") as HTMLInputElement;
      fireEvent.change(input, { target: { files: [makeFile("sub01.csv")] } });

      expect(screen.getByText("sub01.csv")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Process files" })).toBeInTheDocument();
    });

    test("hidden files (dot-prefixed names) are filtered out", () => {
      const { container } = render(<DataUpload {...props()} />);
      const input = container.querySelector("input[multiple]") as HTMLInputElement;
      fireEvent.change(input, {
        target: { files: [makeFile("sub01.csv"), makeFile(".DS_Store")] },
      });

      expect(screen.getByText("sub01.csv")).toBeInTheDocument();
      expect(screen.queryByText(".DS_Store")).not.toBeInTheDocument();
    });

    test("shows folder name and file count after pick", () => {
      const { container } = render(<DataUpload {...props()} />);
      const input = container.querySelector("input[multiple]") as HTMLInputElement;
      const file = makeFile("sub01.csv", "col,val\n1,2", "experiment/sub01.csv");
      fireEvent.change(input, { target: { files: [file] } });

      expect(screen.getByText(/experiment \(1 file\)/)).toBeInTheDocument();
    });
  });

  // ── zip upload ───────────────────────────────────────────────────────────

  describe("zip upload", () => {
    function mockZip(entries: Record<string, { dir: boolean; content?: string }>) {
      const files: Record<string, unknown> = {};
      for (const [name, { dir, content = "" }] of Object.entries(entries)) {
        files[name] = { dir, name, async: jest.fn().mockResolvedValue(content) };
      }
      mockLoadAsync.mockResolvedValue({ files });
    }

    test("extracts files and moves to ready", async () => {
      mockZip({ "data/sub01.csv": { dir: false, content: "rt\n100" } });
      const { container } = render(<DataUpload {...props()} />);
      fireEvent.change(container.querySelector("input[accept='.zip']")!, {
        target: { files: [makeFile("exp.zip")] },
      });

      expect(await screen.findByRole("button", { name: "Process files" })).toBeInTheDocument();
      expect(screen.getByText("data/sub01.csv")).toBeInTheDocument();
    });

    test("strips .zip extension from source name", async () => {
      mockZip({ "sub01.csv": { dir: false } });
      const { container } = render(<DataUpload {...props()} />);
      fireEvent.change(container.querySelector("input[accept='.zip']")!, {
        target: { files: [makeFile("my-experiment.zip")] },
      });

      await screen.findByRole("button", { name: "Process files" });
      expect(screen.getByText(/my-experiment/)).toBeInTheDocument();
    });

    test("filters __MACOSX and hidden files", async () => {
      mockZip({
        "__MACOSX/._sub01.csv": { dir: false },
        "data/.hidden": { dir: false },
        "data/sub01.csv": { dir: false, content: "rt\n100" },
      });
      const { container } = render(<DataUpload {...props()} />);
      fireEvent.change(container.querySelector("input[accept='.zip']")!, {
        target: { files: [makeFile("exp.zip")] },
      });

      await screen.findByText("data/sub01.csv");
      expect(screen.queryByText("__MACOSX/._sub01.csv")).not.toBeInTheDocument();
      expect(screen.queryByText("data/.hidden")).not.toBeInTheDocument();
    });

    test("shows error when zip yields no readable files", async () => {
      mockZip({ "__MACOSX/": { dir: true } });
      const { container } = render(<DataUpload {...props()} />);
      fireEvent.change(container.querySelector("input[accept='.zip']")!, {
        target: { files: [makeFile("empty.zip")] },
      });

      expect(await screen.findByText(/No readable files found/)).toBeInTheDocument();
    });

    test("shows error when zip cannot be parsed", async () => {
      mockLoadAsync.mockRejectedValue(new Error("bad zip"));
      const { container } = render(<DataUpload {...props()} />);
      fireEvent.change(container.querySelector("input[accept='.zip']")!, {
        target: { files: [makeFile("bad.zip")] },
      });

      expect(await screen.findByText(/Could not read the zip file/)).toBeInTheDocument();
    });
  });

  // ── processing ───────────────────────────────────────────────────────────

  describe("processing", () => {
    async function pickAndProcess(file: File, container: HTMLElement) {
      const input = container.querySelector("input[multiple]") as HTMLInputElement;
      fireEvent.change(input, { target: { files: [file] } });
      await userEvent.click(screen.getByRole("button", { name: "Process files" }));
    }

    test("calls generate once per CSV file with the parsed rows", async () => {
      const { container } = render(<DataUpload {...props()} />);
      await pickAndProcess(makeFile("sub01.csv", "rt,stimulus\n100,hello"), container);

      await waitFor(() => expect(meta.generate).toHaveBeenCalledTimes(1));
      // The file is parsed once up front and the rows (not the raw string) are handed to
      // generate(), so it doesn't re-parse the same content.
      expect(meta.generate).toHaveBeenCalledWith(
        expect.any(Array),
        {},
        "csv",
        expect.any(Object),
      );
    });

    test("skips dataset_description.json with 'existing metadata file' detail", async () => {
      const { container } = render(<DataUpload {...props()} />);
      await pickAndProcess(makeFile("dataset_description.json", '{"name":"x"}'), container);

      await screen.findByRole("button", { name: "Continue →" });
      expect(meta.generate).not.toHaveBeenCalled();
      expect(screen.getByText(/existing metadata file/)).toBeInTheDocument();
    });

    test("skips unsupported file types with 'unsupported file type' detail", async () => {
      const { container } = render(<DataUpload {...props()} />);
      await pickAndProcess(makeFile("notes.txt", "some text"), container);

      await screen.findByRole("button", { name: "Continue →" });
      expect(meta.generate).not.toHaveBeenCalled();
      expect(screen.getByText(/unsupported file type/)).toBeInTheDocument();
    });

    test("shows error status when generate throws", async () => {
      meta.generate.mockRejectedValue(new Error("parse failed"));
      const { container } = render(<DataUpload {...props()} />);
      await pickAndProcess(makeFile("bad.csv", "malformed"), container);

      expect(await screen.findByText(/parse failed/)).toBeInTheDocument();
    });

    test("calls generate for a JSON file when trial_index is unique", async () => {
      const content = JSON.stringify([{ trial_index: 0, rt: 100 }]);
      // mockAnalyzeJoinKeys returns isUnique: true from beforeEach — no join key UI
      const { container } = render(<DataUpload {...props()} />);
      await pickAndProcess(makeFile("data.json", content), container);

      await waitFor(() => expect(meta.generate).toHaveBeenCalledTimes(1));
      // generate() receives the parsed rows array, not the raw JSON string (parsed once up front).
      expect(meta.generate).toHaveBeenCalledWith(expect.any(Array), {}, "json", expect.any(Object));
      expect(screen.queryByText(/Rows need a unique identifier/)).not.toBeInTheDocument();
    });

    test("Continue button appears after done and calls onComplete", async () => {
      const { container } = render(<DataUpload {...props()} />);
      await pickAndProcess(makeFile("sub01.csv", "rt\n100"), container);

      const continueBtn = await screen.findByRole("button", { name: "Continue →" });
      await userEvent.click(continueBtn);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  // ── join key chooser ─────────────────────────────────────────────────────

  describe("join key chooser", () => {
    async function renderToJoinKeys(
      candidates = [{ column: "subject", makesUnique: true as boolean }],
    ) {
      mockAnalyzeJoinKeys.mockReturnValue({ isUnique: false, candidates });
      const { container } = render(<DataUpload {...props()} />);
      const input = container.querySelector("input[multiple]") as HTMLInputElement;
      const content = JSON.stringify([{ trial_index: 0, subject: "p1" }]);
      fireEvent.change(input, { target: { files: [makeFile("data.json", content)] } });
      await userEvent.click(screen.getByRole("button", { name: "Process files" }));
      await screen.findByText(/Rows need a unique identifier/);
      return container;
    }

    test("shows warning and candidate columns when trial_index is non-unique", async () => {
      await renderToJoinKeys();
      expect(screen.getByText(/Rows need a unique identifier/)).toBeInTheDocument();
      expect(screen.getByText("subject")).toBeInTheDocument();
      expect(screen.getByText("sufficient alone")).toBeInTheDocument();
    });

    test("help text expands and collapses", async () => {
      await renderToJoinKeys();
      const toggle = screen.getByRole("button", { name: /What is a join key/ });
      expect(screen.queryByText(/nested data/)).not.toBeInTheDocument();

      await userEvent.click(toggle);
      expect(screen.getByText(/nested data/)).toBeInTheDocument();

      await userEvent.click(toggle);
      expect(screen.queryByText(/nested data/)).not.toBeInTheDocument();
    });

    test("selecting a column and applying calls generate with that key", async () => {
      await renderToJoinKeys([{ column: "subject", makesUnique: true }]);
      const subjectItem = screen.getByText("subject").closest("li")!;
      await userEvent.click(within(subjectItem).getByRole("checkbox"));
      await userEvent.click(screen.getByRole("button", { name: "Apply and process files" }));

      await waitFor(() => expect(meta.generate).toHaveBeenCalled());
      expect(meta.generate).toHaveBeenCalledWith(
        expect.any(Array),
        {},
        "json",
        expect.objectContaining({
          arrayJoinKeys: expect.arrayContaining(["trial_index", "subject"]),
        }),
      );
    });

    test('"Proceed anyway" disables candidates and suppresses the warning', async () => {
      await renderToJoinKeys([{ column: "subject", makesUnique: true }]);
      const proceedItem = screen.getByText(/Proceed anyway/).closest("li")!;
      await userEvent.click(within(proceedItem).getByRole("checkbox"));

      expect(within(screen.getByText("subject").closest("li")!).getByRole("checkbox")).toBeDisabled();

      await userEvent.click(screen.getByRole("button", { name: "Apply and process files" }));
      await waitFor(() => expect(meta.generate).toHaveBeenCalled());
      expect(meta.generate).toHaveBeenCalledWith(
        expect.any(Array),
        {},
        "json",
        expect.objectContaining({ arrayJoinKeys: ["trial_index"], suppressJoinKeyWarning: true }),
      );
    });

    test("Cancel returns to the ready phase without processing", async () => {
      await renderToJoinKeys();
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.getByRole("button", { name: "Process files" })).toBeInTheDocument();
      expect(screen.queryByText(/Rows need a unique identifier/)).not.toBeInTheDocument();
      expect(meta.generate).not.toHaveBeenCalled();
    });

    test("Re-configure join keys button appears in the done phase after processing", async () => {
      await renderToJoinKeys([{ column: "subject", makesUnique: true }]);
      await userEvent.click(screen.getByRole("button", { name: "Apply and process files" }));

      // After applying, processing completes and phase becomes 'done'.
      // joinKeyCandidates is non-empty, so the Re-configure button should appear.
      expect(
        await screen.findByRole("button", { name: "Re-configure join keys" }),
      ).toBeInTheDocument();
    });
  });

  // ── session sync ─────────────────────────────────────────────────────────

  describe("session sync", () => {
    test("calls onSessionChange with updated files after folder pick", async () => {
      const { container } = render(<DataUpload {...props()} />);
      const input = container.querySelector("input[multiple]") as HTMLInputElement;
      fireEvent.change(input, { target: { files: [makeFile("sub01.csv")] } });

      await waitFor(() => {
        const lastCall = onSessionChange.mock.calls.at(-1)?.[0] as DataSession;
        expect(lastCall?.files).toHaveLength(1);
        expect(lastCall.files[0].name).toBe("sub01.csv");
      });
    });

    test("calls onSessionChange with extracted files after zip upload", async () => {
      const mockZipFiles = {
        "data/sub01.csv": {
          dir: false,
          name: "data/sub01.csv",
          async: jest.fn().mockResolvedValue("rt\n100"),
        },
      };
      mockLoadAsync.mockResolvedValue({ files: mockZipFiles });

      const { container } = render(<DataUpload {...props()} />);
      fireEvent.change(container.querySelector("input[accept='.zip']")!, {
        target: { files: [makeFile("exp.zip")] },
      });

      await waitFor(() => {
        const lastCall = onSessionChange.mock.calls.at(-1)?.[0] as DataSession;
        expect(lastCall?.files).toHaveLength(1);
        expect(lastCall.files[0].name).toBe("data/sub01.csv");
      });
    });

    test("calls onSessionChange with fileStatuses after processing completes", async () => {
      const { container } = render(<DataUpload {...props()} />);
      const input = container.querySelector("input[multiple]") as HTMLInputElement;
      fireEvent.change(input, { target: { files: [makeFile("sub01.csv", "rt\n100")] } });
      await userEvent.click(screen.getByRole("button", { name: "Process files" }));

      await screen.findByRole("button", { name: "Continue →" });
      await waitFor(() => {
        const lastCall = onSessionChange.mock.calls.at(-1)?.[0] as DataSession;
        expect(lastCall?.fileStatuses).toHaveLength(1);
        expect(lastCall.fileStatuses[0]).toMatchObject({ name: "sub01.csv", status: "success" });
      });
    });
  });
});
