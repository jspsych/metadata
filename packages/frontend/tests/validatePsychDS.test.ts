import jsonld from "jsonld";
import { validateWeb } from "psychds-validator/web/psychds-validator.js";
import {
  validatePsychDS,
  ValidationUnavailableError,
} from "../src/validation/validatePsychDS";

const mockValidateWeb = validateWeb as jest.Mock;

/** jsdom's Blob has no .text(); read it through FileReader instead. */
function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

/** Builds a validator output object in the shape validatePsychDS consumes. */
function validatorOutput(
  issues: {
    key: string;
    reason: string;
    severity: "error" | "warning";
    evidence?: (string | undefined)[];
  }[],
) {
  return {
    issues: new Map(
      issues.map((issue) => [
        issue.key,
        {
          key: issue.key,
          reason: issue.reason,
          severity: issue.severity,
          files: new Map(
            (issue.evidence ?? []).map((evidence, i) => [`file${i}`, { evidence }]),
          ),
        },
      ]),
    ),
  };
}

beforeEach(() => {
  mockValidateWeb.mockReset();
  delete (window as unknown as { jsonld?: unknown }).jsonld;
});

describe("validatePsychDS", () => {
  test("exposes jsonld as a global for the validator's browser path", async () => {
    mockValidateWeb.mockResolvedValue(validatorOutput([]));
    await validatePsychDS("{}");
    expect((window as unknown as { jsonld?: unknown }).jsonld).toBe(jsonld);
  });

  test("does not overwrite an existing window.jsonld", async () => {
    const existing = { already: "here" };
    (window as unknown as { jsonld?: unknown }).jsonld = existing;
    mockValidateWeb.mockResolvedValue(validatorOutput([]));
    await validatePsychDS("{}");
    expect((window as unknown as { jsonld?: unknown }).jsonld).toBe(existing);
  });

  test("places dataset_description.json at the tree root and requests the latest schema", async () => {
    mockValidateWeb.mockResolvedValue(validatorOutput([]));
    await validatePsychDS('{"name":"test"}');

    expect(mockValidateWeb).toHaveBeenCalledTimes(1);
    const [tree, options] = mockValidateWeb.mock.calls[0];
    expect(options).toEqual({ schema: "latest" });
    expect(tree["dataset_description.json"].type).toBe("file");
    await expect(blobText(tree["dataset_description.json"].file)).resolves.toBe('{"name":"test"}');
  });

  test("nests data files under data/, stripping the export folder", async () => {
    mockValidateWeb.mockResolvedValue(validatorOutput([]));
    const dataFiles = new Map([
      ["my-experiment/sub01.csv", "a,b\n1,2"],
      ["my-experiment/session1/sub02.csv", "a,b\n3,4"],
    ]);
    await validatePsychDS("{}", dataFiles);

    const [tree] = mockValidateWeb.mock.calls[0];
    const data = tree["data"];
    expect(data.type).toBe("directory");
    await expect(blobText(data.contents["sub01.csv"].file)).resolves.toBe("a,b\n1,2");
    const session = data.contents["session1"];
    expect(session.type).toBe("directory");
    await expect(blobText(session.contents["sub02.csv"].file)).resolves.toBe("a,b\n3,4");
  });

  test("reports valid when the validator finds no issues", async () => {
    mockValidateWeb.mockResolvedValue(validatorOutput([]));
    const result = await validatePsychDS("{}");
    expect(result).toEqual({ valid: true, errors: [], warnings: [] });
  });

  test("partitions issues into errors and warnings", async () => {
    mockValidateWeb.mockResolvedValue(
      validatorOutput([
        { key: "JSON_KEY_REQUIRED", reason: "missing key", severity: "error" },
        { key: "MISSING_README", reason: "no README", severity: "warning" },
      ]),
    );
    const result = await validatePsychDS("{}");

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      { key: "JSON_KEY_REQUIRED", reason: "missing key", evidence: [] },
    ]);
    expect(result.warnings).toEqual([
      { key: "MISSING_README", reason: "no README", evidence: [] },
    ]);
  });

  test("dedupes per-file evidence and drops empty entries", async () => {
    mockValidateWeb.mockResolvedValue(
      validatorOutput([
        {
          key: "VARIABLE_MISSING_FROM_CSV_COLUMNS",
          reason: "variable not in CSV",
          severity: "error",
          evidence: ["rt, stimulus", "rt, stimulus", "  ", undefined, "response"],
        },
      ]),
    );
    const result = await validatePsychDS("{}");
    expect(result.errors[0].evidence).toEqual(["rt, stimulus", "response"]);
  });

  test("throws ValidationUnavailableError when the validator cannot run", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockValidateWeb.mockRejectedValue(new Error("fetch failed"));
    await expect(validatePsychDS("{}")).rejects.toThrow(ValidationUnavailableError);
    await expect(validatePsychDS("{}")).rejects.toThrow(/internet connection/);
  });
});
