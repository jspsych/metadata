import JsPsychMetadata from "../src/index";
import { VariablesMap, VariableFields } from "../src/VariablesMap";

// Regression tests for the two metadata-generation bugs fixed alongside the
// frontend redesign (see .changeset/fix-metadata-generation-bugs.md):
//   1. user-written string descriptions wiped on a second generate()
//   2. a mixed primitive/array column getting re-typed to "array"

// ─── Bug 1: string descriptions survive a merge ────────────────────────────────

describe("VariablesMap.updateVariable — description preservation", () => {
  function makeColumn(description: string): VariableFields {
    return { "@type": "PropertyValue", name: "col", description, value: "string" };
  }

  test("promotes a user-written string description to { default } when merging", () => {
    const vars = new VariablesMap();
    vars.setVariable(makeColumn("A participant-authored description"));

    // A later generate() pass adds a plugin-sourced description for the same column.
    vars.updateVariable("col", "description", { "mock-plugin": "plugin text" });

    const v = vars.getVariable("col") as VariableFields;
    expect(v.description).toEqual({
      default: "A participant-authored description",
      "mock-plugin": "plugin text",
    });
  });

  test("treats the 'unknown' placeholder (and empty strings) as no description", () => {
    const unknown = new VariablesMap();
    unknown.setVariable(makeColumn("unknown"));
    unknown.updateVariable("col", "description", { "mock-plugin": "plugin text" });
    expect((unknown.getVariable("col") as VariableFields).description).toEqual({
      "mock-plugin": "plugin text",
    });

    const empty = new VariablesMap();
    empty.setVariable(makeColumn(""));
    empty.updateVariable("col", "description", { "mock-plugin": "plugin text" });
    expect((empty.getVariable("col") as VariableFields).description).toEqual({
      "mock-plugin": "plugin text",
    });
  });
});

// ─── Bug 2: mixed primitive/array columns keep their primitive type ────────────

const MOCK_PLUGIN_SOURCE = `
  const info = {
    data: {
      /** The participant's response */
      response: {
        type: ParameterType.OBJECT,
      },
    };
  }
`;

const mockFetch = jest.fn().mockResolvedValue({
  text: () => Promise.resolve(MOCK_PLUGIN_SOURCE),
});

const BASE = { trial_type: "mock-plugin", trial_index: 0, time_elapsed: 100 };

describe("Mixed primitive/array column typing", () => {
  beforeEach(() => {
    (global as any).fetch = mockFetch;
    mockFetch.mockClear();
  });

  test("a string-then-array column stays 'string' (not re-typed to 'array')", async () => {
    // e.g. a `response` column that is a string in keyboard trials and an array
    // in a later survey trial. The string row is seen first.
    const data = JSON.stringify([
      { ...BASE, response: "f" },
      { ...BASE, trial_index: 1, response: ["apple", "banana"] },
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);

    expect((meta.getVariable("response") as VariableFields).value).toBe("string");
  });

  test("a column that is only ever an array is typed 'array'", async () => {
    const data = JSON.stringify([
      { ...BASE, response: ["apple", "banana"] },
      { ...BASE, trial_index: 1, response: ["cherry"] },
    ]);
    const meta = new JsPsychMetadata();
    await meta.generate(data);

    expect((meta.getVariable("response") as VariableFields).value).toBe("array");
  });
});
