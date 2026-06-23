import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppShell from "../src/components/AppShell";

// ── child component stubs ──────────────────────────────────────────────────
jest.mock("../src/components/Sidebar", () => ({
  __esModule: true,
  default: ({ steps, canNavigateTo, onNavigate, onStartOver }: any) => (
    <nav>
      {steps.map((s: any) => (
        <button key={s.id} onClick={() => onNavigate(s.id)} disabled={!canNavigateTo(s.id)}>
          {s.label}
        </button>
      ))}
      <button onClick={onStartOver}>Start over</button>
    </nav>
  ),
}));

jest.mock("../src/components/PreviewDrawer", () => ({
  __esModule: true,
  default: ({ onClose }: any) => (
    <div data-testid="preview-drawer">
      <button onClick={onClose}>Close preview</button>
    </div>
  ),
}));

jest.mock("../src/pages/ProjectInfo", () => ({
  __esModule: true,
  default: ({ onComplete }: any) => (
    <div>
      <span>ProjectInfo page</span>
      <button onClick={onComplete}>Complete ProjectInfo</button>
    </div>
  ),
  emptyProjectInfoSession: () => ({ name: "", description: "", optional: {}, optionalOpen: false }),
  OPTIONAL_FIELDS: [],
}));

// A fake staged store the DataUpload stub can push into the session, so Start Over cleanup can be
// asserted. The `mock` prefix lets the hoisted jest.mock factory reference it (jest rule).
const mockStagedClear = jest.fn();
const mockStagedStore = { clear: mockStagedClear } as any;

jest.mock("../src/pages/DataUpload", () => ({
  __esModule: true,
  default: ({ onComplete, onSessionChange }: any) => (
    <div>
      <span>DataUpload page</span>
      <button onClick={onComplete}>Complete DataUpload</button>
      <button
        onClick={() => onSessionChange({ files: [], fileTexts: new Map(), convertedStore: mockStagedStore })}
      >
        Stage data
      </button>
    </div>
  ),
  emptyDataSession: { fileTexts: [], files: [] },
}));

jest.mock("../src/pages/Variables", () => ({
  __esModule: true,
  default: ({ onComplete }: any) => (
    <div>
      <span>Variables page</span>
      <button onClick={onComplete}>Complete Variables</button>
    </div>
  ),
}));

jest.mock("../src/pages/Authors", () => ({
  __esModule: true,
  default: ({ onComplete }: any) => (
    <div>
      <span>Authors page</span>
      <button onClick={onComplete}>Complete Authors</button>
    </div>
  ),
}));

jest.mock("../src/pages/Review", () => ({
  __esModule: true,
  default: () => <div><span>Review page</span></div>,
}));

// ── fixtures ───────────────────────────────────────────────────────────────

function makeMeta() {
  return { getMetadata: jest.fn().mockReturnValue({}) } as any;
}

let meta: ReturnType<typeof makeMeta>;
let onStartOver: jest.Mock;

beforeEach(() => {
  meta = makeMeta();
  onStartOver = jest.fn();
  mockStagedClear.mockClear();
});

describe("AppShell", () => {
  // ── initial render ────────────────────────────────────────────────────────

  describe("initial render", () => {
    test("starts on the ProjectInfo step", () => {
      render(<AppShell jsPsychMetadata={meta} onStartOver={onStartOver} />);
      expect(screen.getByText("ProjectInfo page")).toBeInTheDocument();
    });

    test("renders the Sidebar with all step labels", () => {
      render(<AppShell jsPsychMetadata={meta} onStartOver={onStartOver} />);
      expect(screen.getByRole("button", { name: "Project Info" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Data" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Variables" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Authors" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Review" })).toBeInTheDocument();
    });

    test("all steps after ProjectInfo are locked (disabled) initially", () => {
      render(<AppShell jsPsychMetadata={meta} onStartOver={onStartOver} />);
      expect(screen.getByRole("button", { name: "Data" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Variables" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Authors" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Review" })).toBeDisabled();
    });
  });

  // ── step navigation ───────────────────────────────────────────────────────

  describe("step completion and navigation", () => {
    test("completing ProjectInfo navigates to Data step", async () => {
      render(<AppShell jsPsychMetadata={meta} onStartOver={onStartOver} />);
      await userEvent.click(screen.getByRole("button", { name: "Complete ProjectInfo" }));

      expect(screen.getByText("DataUpload page")).toBeInTheDocument();
      expect(screen.queryByText("ProjectInfo page")).not.toBeInTheDocument();
    });

    test("completing Data step navigates to Variables", async () => {
      render(<AppShell jsPsychMetadata={meta} onStartOver={onStartOver} />);
      await userEvent.click(screen.getByRole("button", { name: "Complete ProjectInfo" }));
      await userEvent.click(screen.getByRole("button", { name: "Complete DataUpload" }));

      expect(screen.getByText("Variables page")).toBeInTheDocument();
    });

    test("completing Variables navigates to Authors", async () => {
      render(<AppShell jsPsychMetadata={meta} onStartOver={onStartOver} />);
      await userEvent.click(screen.getByRole("button", { name: "Complete ProjectInfo" }));
      await userEvent.click(screen.getByRole("button", { name: "Complete DataUpload" }));
      await userEvent.click(screen.getByRole("button", { name: "Complete Variables" }));

      expect(screen.getByText("Authors page")).toBeInTheDocument();
    });

    test("completing Authors navigates to Review", async () => {
      render(<AppShell jsPsychMetadata={meta} onStartOver={onStartOver} />);
      await userEvent.click(screen.getByRole("button", { name: "Complete ProjectInfo" }));
      await userEvent.click(screen.getByRole("button", { name: "Complete DataUpload" }));
      await userEvent.click(screen.getByRole("button", { name: "Complete Variables" }));
      await userEvent.click(screen.getByRole("button", { name: "Complete Authors" }));

      expect(screen.getByText("Review page")).toBeInTheDocument();
    });

    test("clicking an unlocked Sidebar step navigates to it", async () => {
      render(<AppShell jsPsychMetadata={meta} onStartOver={onStartOver} />);
      // Complete ProjectInfo to unlock Data
      await userEvent.click(screen.getByRole("button", { name: "Complete ProjectInfo" }));
      // Go back to ProjectInfo via sidebar
      await userEvent.click(screen.getByRole("button", { name: "Project Info" }));
      expect(screen.getByText("ProjectInfo page")).toBeInTheDocument();
    });

    test("clicking a disabled Sidebar step does not navigate", async () => {
      render(<AppShell jsPsychMetadata={meta} onStartOver={onStartOver} />);
      await userEvent.click(screen.getByRole("button", { name: "Data" }));
      // Still on ProjectInfo
      expect(screen.getByText("ProjectInfo page")).toBeInTheDocument();
    });
  });

  // ── existing project (skip Data) ──────────────────────────────────────────

  describe("existing project", () => {
    test("completing ProjectInfo skips Data and navigates to Variables", async () => {
      const existingFile = new File(['{"name":"Study"}'], "dataset_description.json");
      render(
        <AppShell
          jsPsychMetadata={meta}
          existingMetadataFile={existingFile}
          onStartOver={onStartOver}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: "Complete ProjectInfo" }));

      expect(screen.getByText("Variables page")).toBeInTheDocument();
      expect(screen.queryByText("DataUpload page")).not.toBeInTheDocument();
    });
  });

  // ── preview pill ──────────────────────────────────────────────────────────

  describe("preview pill", () => {
    test("preview pill is visible on non-review steps", () => {
      render(<AppShell jsPsychMetadata={meta} onStartOver={onStartOver} />);
      expect(screen.getByRole("button", { name: "Open JSON preview" })).toBeInTheDocument();
    });

    test("preview pill is hidden on the Review step", async () => {
      render(<AppShell jsPsychMetadata={meta} onStartOver={onStartOver} />);
      await userEvent.click(screen.getByRole("button", { name: "Complete ProjectInfo" }));
      await userEvent.click(screen.getByRole("button", { name: "Complete DataUpload" }));
      await userEvent.click(screen.getByRole("button", { name: "Complete Variables" }));
      await userEvent.click(screen.getByRole("button", { name: "Complete Authors" }));

      expect(screen.queryByRole("button", { name: "Open JSON preview" })).not.toBeInTheDocument();
    });

    test("clicking the preview pill opens PreviewDrawer", async () => {
      render(<AppShell jsPsychMetadata={meta} onStartOver={onStartOver} />);
      expect(screen.queryByTestId("preview-drawer")).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Open JSON preview" }));
      expect(screen.getByTestId("preview-drawer")).toBeInTheDocument();
    });

    test("closing the PreviewDrawer hides it", async () => {
      render(<AppShell jsPsychMetadata={meta} onStartOver={onStartOver} />);
      await userEvent.click(screen.getByRole("button", { name: "Open JSON preview" }));
      await userEvent.click(screen.getByRole("button", { name: "Close preview" }));

      expect(screen.queryByTestId("preview-drawer")).not.toBeInTheDocument();
    });
  });

  // ── start over passthrough ────────────────────────────────────────────────

  describe("start over", () => {
    test("Sidebar 'Start over' calls the onStartOver prop", async () => {
      render(<AppShell jsPsychMetadata={meta} onStartOver={onStartOver} />);
      await userEvent.click(screen.getByRole("button", { name: "Start over" }));
      expect(onStartOver).toHaveBeenCalledTimes(1);
    });

    test("Start over clears the session's staged file store before bubbling up", async () => {
      render(<AppShell jsPsychMetadata={meta} onStartOver={onStartOver} />);
      await userEvent.click(screen.getByRole("button", { name: "Complete ProjectInfo" }));
      await userEvent.click(screen.getByRole("button", { name: "Stage data" })); // session now holds a store
      await userEvent.click(screen.getByRole("button", { name: "Start over" }));

      expect(mockStagedClear).toHaveBeenCalledTimes(1);
      expect(onStartOver).toHaveBeenCalledTimes(1);
    });

    test("Start over is a no-op for the store when nothing was staged", async () => {
      render(<AppShell jsPsychMetadata={meta} onStartOver={onStartOver} />);
      await userEvent.click(screen.getByRole("button", { name: "Start over" }));

      expect(mockStagedClear).not.toHaveBeenCalled();
      expect(onStartOver).toHaveBeenCalledTimes(1);
    });
  });
});
