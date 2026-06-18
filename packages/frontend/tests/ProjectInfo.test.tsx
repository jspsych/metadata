import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectInfo, { emptyProjectInfoSession } from "../src/pages/ProjectInfo";
import type { ProjectInfoSession } from "../src/pages/ProjectInfo";

function makeMeta(fields: Record<string, unknown> = {}) {
  return {
    loadMetadata: jest.fn(),
    getMetadataField: jest.fn().mockImplementation((key: string) => fields[key] ?? ""),
    setMetadataField: jest.fn(),
    deleteMetadataField: jest.fn(),
  } as any;
}

function session(overrides: Partial<ProjectInfoSession> = {}): ProjectInfoSession {
  return { ...emptyProjectInfoSession(), ...overrides };
}

let meta: ReturnType<typeof makeMeta>;
let onComplete: jest.Mock;
let onSessionChange: jest.Mock;

beforeEach(() => {
  meta = makeMeta();
  onComplete = jest.fn();
  onSessionChange = jest.fn();
});

/** Simulates uploading a JSON file via the pre-fill button. */
function uploadJson(container: HTMLElement, json: Record<string, unknown>) {
  const input = container.querySelector("input[accept='.json']") as HTMLInputElement;
  const file = new File([JSON.stringify(json)], "meta.json", { type: "application/json" });
  fireEvent.change(input, { target: { files: [file] } });
}

describe("ProjectInfo", () => {
  // ── basic render ──────────────────────────────────────────────────────────

  describe("basic render", () => {
    test("renders name and description fields", () => {
      render(
        <ProjectInfo
          jsPsychMetadata={meta}
          session={session()}
          onSessionChange={onSessionChange}
          onComplete={onComplete}
        />,
      );
      expect(screen.getByRole("textbox", { name: /Project name/ })).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: /^Description/ })).toBeInTheDocument();
    });

    test("pre-fills inputs from the session prop", () => {
      render(
        <ProjectInfo
          jsPsychMetadata={meta}
          session={session({ name: "My Study", description: "A description" })}
          onSessionChange={onSessionChange}
          onComplete={onComplete}
        />,
      );
      expect(screen.getByRole("textbox", { name: /Project name/ })).toHaveValue("My Study");
      expect(screen.getByRole("textbox", { name: /^Description/ })).toHaveValue("A description");
    });
  });

  // ── Continue validation ───────────────────────────────────────────────────

  describe("Continue validation", () => {
    test("shows error and does not proceed when name is empty", async () => {
      render(
        <ProjectInfo
          jsPsychMetadata={meta}
          session={session()}
          onSessionChange={onSessionChange}
          onComplete={onComplete}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: "Continue →" }));

      expect(screen.getByText("Project name is required.")).toBeInTheDocument();
      expect(onComplete).not.toHaveBeenCalled();
    });

    test("calls setMetadataField with name and calls onComplete", async () => {
      render(
        <ProjectInfo
          jsPsychMetadata={meta}
          session={session({ name: "My Study" })}
          onSessionChange={onSessionChange}
          onComplete={onComplete}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: "Continue →" }));

      expect(meta.setMetadataField).toHaveBeenCalledWith("name", "My Study");
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    test("empty description writes 'No description provided.'", async () => {
      render(
        <ProjectInfo
          jsPsychMetadata={meta}
          session={session({ name: "My Study" })}
          onSessionChange={onSessionChange}
          onComplete={onComplete}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: "Continue →" }));
      expect(meta.setMetadataField).toHaveBeenCalledWith(
        "description",
        "No description provided.",
      );
    });

    test("non-empty optional fields are saved; empty ones are deleted", async () => {
      render(
        <ProjectInfo
          jsPsychMetadata={meta}
          session={session({ name: "S", optional: { license: "CC0", keywords: "" } })}
          onSessionChange={onSessionChange}
          onComplete={onComplete}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: "Continue →" }));

      expect(meta.setMetadataField).toHaveBeenCalledWith("license", "CC0");
      expect(meta.deleteMetadataField).toHaveBeenCalledWith("keywords");
    });
  });

  // ── optional fields ───────────────────────────────────────────────────────

  describe("optional fields", () => {
    test("optional fields section is collapsed by default", () => {
      render(
        <ProjectInfo
          jsPsychMetadata={meta}
          session={session()}
          onSessionChange={onSessionChange}
          onComplete={onComplete}
        />,
      );
      expect(screen.queryByLabelText("License")).not.toBeInTheDocument();
    });

    test("toggle button calls onSessionChange with optionalOpen: true", async () => {
      render(
        <ProjectInfo
          jsPsychMetadata={meta}
          session={session()}
          onSessionChange={onSessionChange}
          onComplete={onComplete}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: /Optional fields/ }));
      expect(onSessionChange).toHaveBeenCalledWith(
        expect.objectContaining({ optionalOpen: true }),
      );
    });

    test("privacy policy renders as a select, not an input", async () => {
      render(
        <ProjectInfo
          jsPsychMetadata={meta}
          session={session({ optionalOpen: true })}
          onSessionChange={onSessionChange}
          onComplete={onComplete}
        />,
      );
      expect(screen.getByLabelText("Privacy policy")).toBeInstanceOf(HTMLSelectElement);
    });

    test("changing an optional field calls onSessionChange", async () => {
      render(
        <ProjectInfo
          jsPsychMetadata={meta}
          session={session({ optionalOpen: true })}
          onSessionChange={onSessionChange}
          onComplete={onComplete}
        />,
      );
      fireEvent.change(screen.getByLabelText("License"), { target: { value: "CC0" } });
      expect(onSessionChange).toHaveBeenCalledWith(
        expect.objectContaining({ optional: expect.objectContaining({ license: "CC0" }) }),
      );
    });
  });

  // ── help popovers ─────────────────────────────────────────────────────────

  describe("help popovers", () => {
    test("ⓘ next to Description toggles help text", async () => {
      render(
        <ProjectInfo
          jsPsychMetadata={meta}
          session={session()}
          onSessionChange={onSessionChange}
          onComplete={onComplete}
        />,
      );
      const helpBtn = screen.getByRole("button", { name: "Help for Description" });
      expect(screen.queryByText(/helps others understand/i)).not.toBeInTheDocument();

      await userEvent.click(helpBtn);
      expect(screen.getByText(/helps others understand/i)).toBeInTheDocument();

      await userEvent.click(helpBtn);
      expect(screen.queryByText(/helps others understand/i)).not.toBeInTheDocument();
    });

    test("ⓘ next to License shows license help text when optional fields are open", async () => {
      render(
        <ProjectInfo
          jsPsychMetadata={meta}
          session={session({ optionalOpen: true })}
          onSessionChange={onSessionChange}
          onComplete={onComplete}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: "Help for License" }));
      expect(screen.getByText(/CC0/)).toBeInTheDocument();
    });

    test("pre-fill help button toggles the upload explainer", async () => {
      render(
        <ProjectInfo
          jsPsychMetadata={meta}
          session={session()}
          onSessionChange={onSessionChange}
          onComplete={onComplete}
        />,
      );
      const btn = screen.getByRole("button", { name: "Help for pre-fill from JSON" });
      await userEvent.click(btn);
      expect(screen.getByText(/Array values/)).toBeInTheDocument();

      await userEvent.click(btn);
      expect(screen.queryByText(/Array values/)).not.toBeInTheDocument();
    });
  });

  // ── JSON pre-fill ─────────────────────────────────────────────────────────

  describe("JSON pre-fill", () => {
    test("no conflict: applies name and description immediately", async () => {
      const { container } = render(
        <ProjectInfo
          jsPsychMetadata={meta}
          session={session()}
          onSessionChange={onSessionChange}
          onComplete={onComplete}
        />,
      );
      uploadJson(container, { name: "New Study", description: "New desc" });

      await waitFor(() =>
        expect(onSessionChange).toHaveBeenCalledWith(
          expect.objectContaining({ name: "New Study", description: "New desc" }),
        ),
      );
    });

    test("array keyword values are joined as comma-separated text", async () => {
      const { container } = render(
        <ProjectInfo
          jsPsychMetadata={meta}
          session={session()}
          onSessionChange={onSessionChange}
          onComplete={onComplete}
        />,
      );
      uploadJson(container, { keywords: ["stroop", "reaction time"] });

      await waitFor(() =>
        expect(onSessionChange).toHaveBeenCalledWith(
          expect.objectContaining({
            optional: expect.objectContaining({ keywords: "stroop, reaction time" }),
          }),
        ),
      );
    });

    test("conflict: shows conflict callout when uploaded name differs from current", async () => {
      const { container } = render(
        <ProjectInfo
          jsPsychMetadata={meta}
          session={session({ name: "Existing" })}
          onSessionChange={onSessionChange}
          onComplete={onComplete}
        />,
      );
      uploadJson(container, { name: "Uploaded" });

      expect(await screen.findByText(/different "name"/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Yes, overwrite" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "No, keep mine" })).toBeInTheDocument();
    });

    test("conflict: 'See details' expands current vs uploaded comparison", async () => {
      const { container } = render(
        <ProjectInfo
          jsPsychMetadata={meta}
          session={session({ name: "Existing Name" })}
          onSessionChange={onSessionChange}
          onComplete={onComplete}
        />,
      );
      uploadJson(container, { name: "Different Name" });

      await userEvent.click(await screen.findByRole("button", { name: /See details/ }));
      expect(screen.getByText("Existing Name")).toBeInTheDocument();
      expect(screen.getByText("Different Name")).toBeInTheDocument();
    });

    test("conflict: 'Yes, overwrite' calls onSessionChange with uploaded values", async () => {
      const { container } = render(
        <ProjectInfo
          jsPsychMetadata={meta}
          session={session({ name: "Existing" })}
          onSessionChange={onSessionChange}
          onComplete={onComplete}
        />,
      );
      uploadJson(container, { name: "Uploaded" });
      await userEvent.click(await screen.findByRole("button", { name: "Yes, overwrite" }));

      expect(onSessionChange).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Uploaded" }),
      );
      expect(screen.queryByRole("button", { name: "Yes, overwrite" })).not.toBeInTheDocument();
    });

    test("conflict: 'No, keep mine' applies optional fields but keeps current name", async () => {
      const { container } = render(
        <ProjectInfo
          jsPsychMetadata={meta}
          session={session({ name: "Existing" })}
          onSessionChange={onSessionChange}
          onComplete={onComplete}
        />,
      );
      uploadJson(container, { name: "Uploaded", license: "CC0" });
      await userEvent.click(await screen.findByRole("button", { name: "No, keep mine" }));

      const call = onSessionChange.mock.calls.at(-1)?.[0] as ProjectInfoSession;
      expect(call.name).toBe("Existing");
      expect(call.optional.license).toBe("CC0");
    });
  });

  // ── existing metadata file ────────────────────────────────────────────────

  describe("existing metadata file (open existing project)", () => {
    test("loads metadata from the file and calls onSessionChange", async () => {
      const fields: Record<string, unknown> = { name: "Loaded Study", description: "Loaded desc" };
      meta = makeMeta(fields);
      const file = new File(['{"name":"Loaded Study"}'], "dataset_description.json");

      render(
        <ProjectInfo
          jsPsychMetadata={meta}
          existingMetadataFile={file}
          session={session()}
          onSessionChange={onSessionChange}
          onComplete={onComplete}
        />,
      );

      await waitFor(() => expect(meta.loadMetadata).toHaveBeenCalledTimes(1));
      expect(onSessionChange).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Loaded Study" }),
      );
    });

    test("shows a loaded banner after successful file load", async () => {
      meta = makeMeta({ name: "Study" });
      const file = new File(['{"name":"Study"}'], "dataset_description.json");

      render(
        <ProjectInfo
          jsPsychMetadata={meta}
          existingMetadataFile={file}
          session={session()}
          onSessionChange={onSessionChange}
          onComplete={onComplete}
        />,
      );

      expect(await screen.findByText(/Loaded from/)).toBeInTheDocument();
    });
  });
});
