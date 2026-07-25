import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JsPsychMetadata from "@jspsych/metadata";
import AppShell from "../src/components/AppShell";

// Integration test with the REAL ProjectInfo page inside the REAL AppShell (only the validator,
// which Review lazy-loads, would touch the network — and we never open Review here). Guards the
// state-loss bug where revisiting Project Info re-ran loadMetadata and clobbered session edits.

const METADATA_JSON = JSON.stringify({
  name: "Loaded Study",
  description: "A loaded description.",
  schemaVersion: "Psych-DS 0.4.0",
  variableMeasured: [
    { name: "rt", type: "PropertyValue", description: "reaction time" },
    { name: "stimulus", type: "PropertyValue", description: "the stimulus" },
  ],
});

function existingFile() {
  return new File([METADATA_JSON], "dataset_description.json", { type: "application/json" });
}

describe("AppShell + real ProjectInfo (existing project)", () => {
  test("loads existing metadata exactly once, even after revisiting Project Info", async () => {
    const meta = new JsPsychMetadata();
    const loadSpy = jest.spyOn(meta, "loadMetadata");

    render(<AppShell jsPsychMetadata={meta} existingMetadataFile={existingFile()} onStartOver={jest.fn()} />);

    // First mount loads the file once and populates the form.
    await screen.findByText(/Loaded from/);
    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("textbox", { name: /Project name/ })).toHaveValue("Loaded Study");

    // Continue — existing metadata is loaded, so Data is pre-completed and we skip to Variables.
    await userEvent.click(screen.getByRole("button", { name: "Continue →" }));
    await screen.findByText(/variables? found in your data/);

    // Simulate an edit made on another step: delete a variable directly on the instance.
    meta.deleteVariable("rt");
    expect(meta.getVariableNames()).not.toContain("rt");

    // Navigate back to Project Info via the sidebar — this remounts the page.
    await userEvent.click(screen.getByRole("button", { name: /Project Info/ }));
    await screen.findByRole("textbox", { name: /Project name/ });

    // loadMetadata must NOT have run again (it would resurrect the deleted variable and clobber edits).
    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(meta.getVariableNames()).not.toContain("rt");
    // Session preserved — the name field still shows the loaded value.
    expect(screen.getByRole("textbox", { name: /Project name/ })).toHaveValue("Loaded Study");
  });

  test("a failed metadata parse does not pre-complete Data or claim variables were loaded", async () => {
    const meta = new JsPsychMetadata();
    const badFile = new File(["not valid json {"], "dataset_description.json");

    render(<AppShell jsPsychMetadata={meta} existingMetadataFile={badFile} onStartOver={jest.fn()} />);

    await screen.findByText(/We couldn.t read that metadata file/);

    // Continuing must land on the Data step (not skip it), and Data must NOT show the
    // "variables loaded from existing metadata" banner.
    await userEvent.type(screen.getByRole("textbox", { name: /Project name/ }), "Manual");
    await userEvent.click(screen.getByRole("button", { name: "Continue →" }));

    expect(await screen.findByText(/Choose the folder holding your data files/)).toBeInTheDocument();
    expect(screen.queryByText(/Variables loaded from existing metadata/)).not.toBeInTheDocument();
  });
});
