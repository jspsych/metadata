import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JsPsychMetadata from "@jspsych/metadata";
import Review from "../src/pages/Review";
import { validatePsychDS } from "../src/validation/validatePsychDS";

// Review lazy-loads the validator wrapper on the first Validate click; mock it
// so tests exercise the UI states without the real (network-bound) validator.
jest.mock("../src/validation/validatePsychDS", () => ({
  validatePsychDS: jest.fn(),
}));

const mockValidate = validatePsychDS as jest.Mock;

function makeMetadata(name = "my-project") {
  const metadata = new JsPsychMetadata();
  metadata.setMetadataField("name", name);
  return metadata;
}

beforeEach(() => {
  mockValidate.mockReset();
  (URL.createObjectURL as jest.Mock).mockClear();
});

describe("Review", () => {
  test("renders the generated metadata", () => {
    render(<Review jsPsychMetadata={makeMetadata()} />);
    // "name" recurs inside variableMeasured entries, so just assert it appears.
    expect(screen.getAllByText('"name"').length).toBeGreaterThan(0);
    expect(screen.getByText('"my-project"')).toBeInTheDocument();
  });

  test("offers only the single-file save when there are no data files", () => {
    render(<Review jsPsychMetadata={makeMetadata()} />);
    expect(
      screen.getByRole("button", { name: "Save dataset_description.json" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /\.zip/ })).not.toBeInTheDocument();
  });

  test("offers a zip download named after the project when data files exist", () => {
    // dataFiles is the converted Psych-DS payload (path -> contents), already built upstream.
    const dataFiles = new Map([["data/subject-sub01_data.csv", "a,b\n1,2"]]);
    render(<Review jsPsychMetadata={makeMetadata()} dataFiles={dataFiles} />);
    expect(
      screen.getByRole("button", { name: "Download my-project.zip" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save dataset_description.json only" }),
    ).toBeInTheDocument();
  });

  test("offers only the single-file save when the converted payload is empty", () => {
    render(<Review jsPsychMetadata={makeMetadata()} dataFiles={new Map()} />);
    expect(
      screen.getByRole("button", { name: "Save dataset_description.json" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /\.zip/ })).not.toBeInTheDocument();
  });

  test("saving the metadata file downloads it and confirms", async () => {
    render(<Review jsPsychMetadata={makeMetadata()} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Save dataset_description.json" }),
    );
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "✓ Saved" })).toBeInTheDocument();
  });

  test("downloading the zip bundles metadata plus data files and confirms", async () => {
    const dataFiles = new Map([["data/subject-sub01_data.csv", "a,b\n1,2"]]);
    render(<Review jsPsychMetadata={makeMetadata()} dataFiles={dataFiles} />);
    await userEvent.click(screen.getByRole("button", { name: "Download my-project.zip" }));

    expect(await screen.findByRole("button", { name: "✓ Downloaded" })).toBeInTheDocument();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  test("validates the metadata and passes the converted data payload through", async () => {
    mockValidate.mockResolvedValue({ valid: true, errors: [], warnings: [] });
    const dataFiles = new Map([["data/subject-sub01_data.csv", "a,b\n1,2"]]);
    render(<Review jsPsychMetadata={makeMetadata()} dataFiles={dataFiles} />);
    await userEvent.click(screen.getByRole("button", { name: "Validate dataset" }));

    expect(await screen.findByText("✓ Valid Psych-DS dataset")).toBeInTheDocument();
    expect(mockValidate).toHaveBeenCalledWith(
      expect.stringContaining('"my-project"'),
      new Map([["data/subject-sub01_data.csv", "a,b\n1,2"]]),
    );
    // Button switches to re-validate after a run.
    expect(screen.getByRole("button", { name: "Re-validate" })).toBeInTheDocument();
  });

  test("shows errors and warnings with their evidence", async () => {
    mockValidate.mockResolvedValue({
      valid: false,
      errors: [
        {
          key: "VARIABLE_MISSING_FROM_CSV_COLUMNS",
          reason: "variable not found in CSV",
          evidence: ["rt, stimulus"],
        },
        { key: "JSON_KEY_REQUIRED", reason: "missing required key", evidence: [] },
      ],
      warnings: [
        { key: "MISSING_README", reason: "no README found", evidence: [] },
      ],
    });
    render(<Review jsPsychMetadata={makeMetadata()} />);
    await userEvent.click(screen.getByRole("button", { name: "Validate dataset" }));

    expect(await screen.findByText("✗ 2 errors found · 1 warning")).toBeInTheDocument();
    expect(screen.getByText("Errors")).toBeInTheDocument();
    expect(screen.getByText("VARIABLE_MISSING_FROM_CSV_COLUMNS")).toBeInTheDocument();
    expect(screen.getByText("rt, stimulus")).toBeInTheDocument();
    expect(screen.getByText("Warnings")).toBeInTheDocument();
    expect(screen.getByText("MISSING_README")).toBeInTheDocument();
  });

  test("shows the validator's own message when validation is unavailable", async () => {
    const err = new Error("The validator could not reach the schema server.");
    err.name = "ValidationUnavailableError";
    mockValidate.mockRejectedValue(err);
    render(<Review jsPsychMetadata={makeMetadata()} />);
    await userEvent.click(screen.getByRole("button", { name: "Validate dataset" }));

    expect(
      await screen.findByText("The validator could not reach the schema server."),
    ).toBeInTheDocument();
  });

  test("wraps unexpected validation failures in a generic message", async () => {
    mockValidate.mockRejectedValue(new Error("boom"));
    render(<Review jsPsychMetadata={makeMetadata()} />);
    await userEvent.click(screen.getByRole("button", { name: "Validate dataset" }));

    expect(
      await screen.findByText("Validation failed unexpectedly: boom"),
    ).toBeInTheDocument();
  });

  test("keeps the CLI instructions available as a fallback", () => {
    render(<Review jsPsychMetadata={makeMetadata()} />);
    expect(screen.getByText("Prefer the command line?")).toBeInTheDocument();
    expect(screen.getByText("npx @jspsych/cli validate")).toBeInTheDocument();
  });
});
