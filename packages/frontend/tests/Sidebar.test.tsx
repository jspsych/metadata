import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Sidebar from "../src/components/Sidebar";
import { STEPS } from "../src/components/AppShell";

// jsdom does not implement showModal — stub it so the dialog renders.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = jest.fn().mockImplementation(
    function (this: HTMLDialogElement) { this.setAttribute("open", ""); },
  );
  HTMLDialogElement.prototype.close = jest.fn().mockImplementation(
    function (this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    },
  );
});

const defaultProps = {
  steps: STEPS,
  currentStep: "projectInfo" as const,
  completedSteps: new Set<"projectInfo" | "data" | "variables" | "authors" | "review">(),
  canNavigateTo: (id: string) => id === "projectInfo",
  onNavigate: jest.fn(),
  onStartOver: jest.fn(),
};

let onNavigate: jest.Mock;
let onStartOver: jest.Mock;

function props(overrides: Partial<typeof defaultProps> = {}) {
  return { ...defaultProps, onNavigate, onStartOver, ...overrides };
}

beforeEach(() => {
  onNavigate = jest.fn();
  onStartOver = jest.fn();
});

describe("Sidebar", () => {
  // ── step list ─────────────────────────────────────────────────────────────

  describe("step list", () => {
    test("renders a button for every step", () => {
      render(<Sidebar {...props()} />);
      for (const { label } of STEPS) {
        expect(screen.getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
      }
    });

    test("the active step button is not disabled", () => {
      render(<Sidebar {...props()} />);
      expect(screen.getByRole("button", { name: /Project Info/ })).not.toBeDisabled();
    });

    test("locked steps (not navigable, not active) are disabled", () => {
      render(<Sidebar {...props()} />);
      // Only projectInfo is navigable, all others are locked
      const dataBtn = screen.getByRole("button", { name: /^Data/ });
      expect(dataBtn).toBeDisabled();
    });

    test("unlocked, non-active steps are enabled", () => {
      render(
        <Sidebar
          {...props({
            completedSteps: new Set(["projectInfo"] as const),
            canNavigateTo: () => true,
          })}
        />,
      );
      expect(screen.getByRole("button", { name: /^Data/ })).not.toBeDisabled();
    });

    test("completed steps show a checkmark", () => {
      render(
        <Sidebar
          {...props({ completedSteps: new Set(["projectInfo"] as const) })}
        />,
      );
      const projectInfoBtn = screen.getByRole("button", { name: /Project Info/ });
      expect(within(projectInfoBtn).getByText("✓")).toBeInTheDocument();
    });

    test("clicking an enabled step calls onNavigate with its id", async () => {
      render(
        <Sidebar
          {...props({ canNavigateTo: () => true })}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: /^Data/ }));
      expect(onNavigate).toHaveBeenCalledWith("data");
    });

    test("clicking a disabled step does not call onNavigate", async () => {
      render(<Sidebar {...props()} />);
      // "Data" is locked — its button is disabled, click should not fire
      await userEvent.click(screen.getByRole("button", { name: /^Data/ }));
      expect(onNavigate).not.toHaveBeenCalled();
    });
  });

  // ── start over dialog ─────────────────────────────────────────────────────

  describe("start over dialog", () => {
    test("'← Start over' button opens the confirmation dialog", async () => {
      render(<Sidebar {...props()} />);
      expect(screen.queryByText("Start over?")).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "← Start over" }));
      expect(screen.getByText("Start over?")).toBeInTheDocument();
    });

    test("'Yes, start over' calls onStartOver", async () => {
      render(<Sidebar {...props()} />);
      await userEvent.click(screen.getByRole("button", { name: "← Start over" }));
      await userEvent.click(screen.getByRole("button", { name: "Yes, start over" }));
      expect(onStartOver).toHaveBeenCalledTimes(1);
    });

    test("'Cancel' closes the dialog without calling onStartOver", async () => {
      render(<Sidebar {...props()} />);
      await userEvent.click(screen.getByRole("button", { name: "← Start over" }));
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onStartOver).not.toHaveBeenCalled();
      expect(screen.queryByText("Start over?")).not.toBeInTheDocument();
    });
  });
});
