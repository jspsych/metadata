import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Variables from "../src/pages/Variables";

// Mirrors VariableFields from @jspsych/metadata — defined locally so we don't
// need to import from the real package (the component only uses it as a type).
type VarFields = {
  name: string;
  value?: string;
  description?: string | Record<string, string>;
  levels?: string[];
  minValue?: number;
  maxValue?: number;
};

function makeVar(name: string, overrides: Partial<VarFields> = {}): VarFields {
  return { name, ...overrides };
}

// Unknown var: missing or 'unknown' type / description (lands in "Missing descriptions").
function unknownVar(name: string, overrides: Partial<VarFields> = {}) {
  return makeVar(name, { value: "unknown", ...overrides });
}

// Known var: has a concrete type and description (lands in "Other variables").
function knownVar(name: string, overrides: Partial<VarFields> = {}) {
  return makeVar(name, {
    value: "string",
    description: "A description",
    ...overrides,
  });
}

function makeMeta(vars: VarFields[] = []) {
  const map = new Map(vars.map((v) => [v.name, v]));
  return {
    getVariableNames: jest.fn().mockReturnValue(vars.map((v) => v.name)),
    getVariable: jest.fn().mockImplementation((name: string) => map.get(name)),
    updateVariable: jest.fn(),
  } as any;
}

/** Returns the <li> element for a variable by its name. */
function varRow(name: string) {
  return screen.getByText(name).closest("li")!;
}

let onComplete: jest.Mock;

beforeEach(() => {
  onComplete = jest.fn();
});

describe("Variables", () => {
  // ── sections ─────────────────────────────────────────────────────────────

  describe("sections", () => {
    test("puts unknowns in 'Missing descriptions' and knowns in 'Other variables'", () => {
      const meta = makeMeta([unknownVar("rt"), knownVar("stimulus")]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);

      const missing = screen.getByText("Missing descriptions").closest("section")!;
      const other = screen.getByText("Other variables").closest("section")!;
      expect(within(missing).getByText("rt")).toBeInTheDocument();
      expect(within(other).getByText("stimulus")).toBeInTheDocument();
    });

    test("shows no 'Missing descriptions' section when all vars are known", () => {
      const meta = makeMeta([knownVar("stimulus"), knownVar("rt")]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);

      expect(screen.queryByText("Missing descriptions")).not.toBeInTheDocument();
      expect(screen.getByText("Other variables")).toBeInTheDocument();
    });

    test("shows no 'Other variables' section when all vars are unknown", () => {
      const meta = makeMeta([unknownVar("rt"), unknownVar("trial_type")]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);

      expect(screen.getByText("Missing descriptions")).toBeInTheDocument();
      expect(screen.queryByText("Other variables")).not.toBeInTheDocument();
    });

    test("sorts vars alphabetically within each section", () => {
      const meta = makeMeta([unknownVar("z_var"), unknownVar("a_var")]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);

      const items = screen.getAllByRole("listitem");
      const names = items.map((li) => li.querySelector("span")?.textContent);
      expect(names.indexOf("a_var")).toBeLessThan(names.indexOf("z_var"));
    });

    test("renders the total variable count in the header", () => {
      const meta = makeMeta([unknownVar("rt"), knownVar("stimulus")]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("2");
    });

    test("renders cleanly with zero variables", () => {
      render(<Variables jsPsychMetadata={makeMeta([])} onComplete={onComplete} />);
      expect(screen.queryByText("Missing descriptions")).not.toBeInTheDocument();
      expect(screen.queryByText("Other variables")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Continue →" })).toBeInTheDocument();
    });
  });

  // ── expand / collapse ────────────────────────────────────────────────────

  describe("expand / collapse", () => {
    test("unknown vars start expanded, known vars start collapsed", () => {
      const meta = makeMeta([unknownVar("rt"), knownVar("stimulus")]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);

      expect(within(varRow("rt")).getByRole("button")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      expect(within(varRow("stimulus")).getByRole("button")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });

    test("clicking a row header toggles it open and closed", async () => {
      const meta = makeMeta([knownVar("stimulus")]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);

      const header = within(varRow("stimulus")).getByRole("button");
      expect(header).toHaveAttribute("aria-expanded", "false");

      await userEvent.click(header);
      expect(header).toHaveAttribute("aria-expanded", "true");

      await userEvent.click(header);
      expect(header).toHaveAttribute("aria-expanded", "false");
    });

    test("expanded row shows textarea, type select, and chevron ▲", async () => {
      const meta = makeMeta([unknownVar("rt")]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);

      // rt starts expanded
      const row = varRow("rt");
      expect(within(row).getByRole("textbox")).toBeInTheDocument();
      expect(within(row).getByRole("combobox")).toBeInTheDocument();
      expect(within(row).getByText("▲")).toBeInTheDocument();
    });

    test("collapsed row hides textarea and type select", () => {
      const meta = makeMeta([knownVar("stimulus")]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);

      const row = varRow("stimulus");
      expect(within(row).queryByRole("textbox")).not.toBeInTheDocument();
      expect(within(row).queryByRole("combobox")).not.toBeInTheDocument();
    });
  });

  // ── expand all ───────────────────────────────────────────────────────────

  describe("expand all toggle", () => {
    test("checking 'Expand all' expands every row", async () => {
      const meta = makeMeta([unknownVar("rt"), knownVar("stimulus")]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);

      await userEvent.click(screen.getByRole("checkbox", { name: /Expand all/ }));

      expect(within(varRow("rt")).getByRole("button")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      expect(within(varRow("stimulus")).getByRole("button")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    });

    test("unchecking 'Expand all' collapses every row", async () => {
      const meta = makeMeta([unknownVar("rt"), knownVar("stimulus")]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);

      const toggle = screen.getByRole("checkbox", { name: /Expand all/ });
      await userEvent.click(toggle); // expand all
      await userEvent.click(toggle); // collapse all

      expect(within(varRow("rt")).getByRole("button")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      expect(within(varRow("stimulus")).getByRole("button")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });

    test("toggle is checked only when all rows are expanded", async () => {
      const meta = makeMeta([unknownVar("rt"), knownVar("stimulus")]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);

      const toggle = screen.getByRole("checkbox", { name: /Expand all/ });
      expect(toggle).not.toBeChecked();

      await userEvent.click(toggle);
      expect(toggle).toBeChecked();
    });
  });

  // ── badges ───────────────────────────────────────────────────────────────

  describe("badges", () => {
    test("shows '⚠ no description' badge on unknown vars", () => {
      const meta = makeMeta([unknownVar("rt")]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);
      expect(within(varRow("rt")).getByText(/⚠ no description/)).toBeInTheDocument();
    });

    test("shows type badge with the variable's type", () => {
      const meta = makeMeta([knownVar("rt", { value: "numeric", description: "RT" })]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);
      expect(within(varRow("rt")).getByText("numeric")).toBeInTheDocument();
    });

    test("shows 'unknown' type badge when value is absent", () => {
      const meta = makeMeta([makeVar("rt")]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);
      // Scope to the header button to avoid matching the 'unknown' option inside the select.
      const header = within(varRow("rt")).getByRole("button");
      expect(within(header).getByText("unknown")).toBeInTheDocument();
    });
  });

  // ── description editing ───────────────────────────────────────────────────

  describe("description editing", () => {
    test("typing in textarea calls updateVariable with the new description", async () => {
      const meta = makeMeta([unknownVar("rt")]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);

      const textarea = within(varRow("rt")).getByRole("textbox");
      await userEvent.clear(textarea);
      await userEvent.type(textarea, "Reaction time");

      expect(meta.updateVariable).toHaveBeenCalledWith(
        "rt",
        "description",
        expect.objectContaining({ default: expect.stringContaining("Reaction time") }),
      );
    });

    test("badge changes to '✓ filled in' after a description is provided", async () => {
      // Use a var with a concrete type but no description — once a description is
      // typed, isUnknown() returns false and the badge switches to "✓ filled in".
      const meta = makeMeta([makeVar("rt", { value: "numeric" })]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);

      const textarea = within(varRow("rt")).getByRole("textbox");
      await userEvent.type(textarea, "Reaction time");

      expect(within(varRow("rt")).getByText(/✓ filled in/)).toBeInTheDocument();
      expect(within(varRow("rt")).queryByText(/⚠ no description/)).not.toBeInTheDocument();
    });

    test("progress counter increments as descriptions are filled in", async () => {
      // Concrete types, no descriptions → both start as unknown; filling in one
      // moves the counter from 0/2 to 1/2.
      const meta = makeMeta([makeVar("rt", { value: "numeric" }), makeVar("stimulus", { value: "string" })]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);

      expect(screen.getByText(/0 \/ 2 filled in/)).toBeInTheDocument();

      const textarea = within(varRow("rt")).getByRole("textbox");
      await userEvent.type(textarea, "Reaction time");

      expect(screen.getByText(/1 \/ 2 filled in/)).toBeInTheDocument();
    });

    test("shows plugin-description caption when description comes from plugin docs", async () => {
      // No 'default' key → description is from plugin; caption appears when expanded.
      // isUnknown() returns false here (non-unknown type + non-empty description),
      // so the row starts in "Other variables" and is collapsed by default.
      const meta = makeMeta([
        makeVar("rt", {
          value: "numeric",
          description: { somePlugin: "Response time in ms" },
        }),
      ]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);

      await userEvent.click(within(varRow("rt")).getByRole("button")); // expand
      expect(
        within(varRow("rt")).getByText(/From plugin documentation/),
      ).toBeInTheDocument();
    });
  });

  // ── type editing ──────────────────────────────────────────────────────────

  describe("type editing", () => {
    test("changing the type select calls updateVariable", async () => {
      const meta = makeMeta([unknownVar("rt")]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);

      const select = within(varRow("rt")).getByRole("combobox");
      await userEvent.selectOptions(select, "numeric");

      expect(meta.updateVariable).toHaveBeenCalledWith("rt", "value", "numeric");
    });

    test("all five type options are present", () => {
      const meta = makeMeta([unknownVar("rt")]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);

      const select = within(varRow("rt")).getByRole("combobox");
      const options = within(select).getAllByRole("option").map((o) => o.textContent);
      expect(options).toEqual(
        expect.arrayContaining(["string", "numeric", "boolean", "array", "unknown"]),
      );
    });
  });

  // ── levels ────────────────────────────────────────────────────────────────

  describe("levels", () => {
    test("shows detected levels when expanded", async () => {
      const meta = makeMeta([
        knownVar("condition", { levels: ["A", "B", "C"] }),
      ]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);

      await userEvent.click(within(varRow("condition")).getByRole("button"));
      expect(within(varRow("condition")).getByText("A")).toBeInTheDocument();
      expect(within(varRow("condition")).getByText("B")).toBeInTheDocument();
    });

    test("truncates at 5 and shows 'Show all N levels' button", async () => {
      const levels = ["A", "B", "C", "D", "E", "F", "G"];
      const meta = makeMeta([knownVar("condition", { levels })]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);

      await userEvent.click(within(varRow("condition")).getByRole("button"));

      expect(within(varRow("condition")).queryByText("F")).not.toBeInTheDocument();
      expect(
        within(varRow("condition")).getByText("Show all 7 levels ▼"),
      ).toBeInTheDocument();
    });

    test("'Show all' expands levels and 'Collapse' hides them again", async () => {
      const levels = ["A", "B", "C", "D", "E", "F", "G"];
      const meta = makeMeta([knownVar("condition", { levels })]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);

      await userEvent.click(within(varRow("condition")).getByRole("button")); // expand row

      await userEvent.click(within(varRow("condition")).getByText("Show all 7 levels ▼"));
      expect(within(varRow("condition")).getByText("F")).toBeInTheDocument();
      expect(within(varRow("condition")).getByText("Collapse ▲")).toBeInTheDocument();

      await userEvent.click(within(varRow("condition")).getByText("Collapse ▲"));
      expect(within(varRow("condition")).queryByText("F")).not.toBeInTheDocument();
    });

    test("no 'Show all' button when levels count is ≤ 5", async () => {
      const meta = makeMeta([knownVar("condition", { levels: ["A", "B", "C"] })]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);

      await userEvent.click(within(varRow("condition")).getByRole("button"));
      expect(within(varRow("condition")).queryByText(/Show all/)).not.toBeInTheDocument();
    });
  });

  // ── range ─────────────────────────────────────────────────────────────────

  describe("range display", () => {
    test("shows min – max when both are present", async () => {
      const meta = makeMeta([
        knownVar("rt", { value: "numeric", minValue: 100, maxValue: 2500 }),
      ]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);

      await userEvent.click(within(varRow("rt")).getByRole("button"));
      expect(within(varRow("rt")).getByText(/100/)).toBeInTheDocument();
      expect(within(varRow("rt")).getByText(/2500/)).toBeInTheDocument();
    });

    test("hides range section when neither min nor max is defined", async () => {
      const meta = makeMeta([knownVar("condition")]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);

      await userEvent.click(within(varRow("condition")).getByRole("button"));
      expect(within(varRow("condition")).queryByText("Range")).not.toBeInTheDocument();
    });

    test("shows em-dash placeholder for missing half of range", async () => {
      const meta = makeMeta([
        knownVar("rt_min", { value: "numeric", minValue: 50 }),
        knownVar("rt_max", { value: "numeric", maxValue: 2000 }),
      ]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);

      await userEvent.click(within(varRow("rt_min")).getByRole("button"));
      expect(within(varRow("rt_min")).getByText(/50/)).toBeInTheDocument();
      expect(within(varRow("rt_min")).getByText(/—/)).toBeInTheDocument();

      await userEvent.click(within(varRow("rt_max")).getByRole("button"));
      expect(within(varRow("rt_max")).getByText(/2000/)).toBeInTheDocument();
      expect(within(varRow("rt_max")).getByText(/—/)).toBeInTheDocument();
    });
  });

  // ── continue ──────────────────────────────────────────────────────────────

  describe("continue", () => {
    test("Continue button calls onComplete", async () => {
      const meta = makeMeta([knownVar("rt")]);
      render(<Variables jsPsychMetadata={meta} onComplete={onComplete} />);

      await userEvent.click(screen.getByRole("button", { name: "Continue →" }));
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });
});
