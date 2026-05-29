import JsPsychMetadata from "../src/index";

// Minimal jsPsych plugin source shapes used across tests
const FLAT_PLUGIN_SOURCE = `
const info = <const>{
  name: "mock-flat",
  parameters: {},
  data: {
    /** The key the participant pressed. */
    response: {
      type: ParameterType.STRING,
    },
    /** Reaction time in milliseconds. */
    rt: {
      type: ParameterType.INT,
    },
  },
  citations: '__CITATIONS__',
};
`;

// Plugin with a nested sub-object inside the data block (like jsPsych-instructions view_history)
const NESTED_PLUGIN_SOURCE = `
const info = <const>{
  name: "mock-nested",
  parameters: {},
  data: {
    /** History of pages viewed. */
    view_history: {
      type: ParameterType.COMPLEX,
      array: true,
      nested: {
        page_index: {
          type: ParameterType.INT,
        },
        viewing_time: {
          type: ParameterType.INT,
        },
      },
    },
    /** Reaction time in milliseconds. */
    rt: {
      type: ParameterType.INT,
    },
  },
  citations: '__CITATIONS__',
};
`;

function makeFetch(source: string, status = 200) {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(source),
  });
}

describe("PluginCache parsing fixes", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test("flat plugin: descriptions are extracted correctly", async () => {
    (global as any).fetch = makeFetch(FLAT_PLUGIN_SOURCE);
    const meta = new JsPsychMetadata();
    await meta.generate(
      JSON.stringify([{ trial_type: "mock-flat", trial_index: 0, time_elapsed: 100, response: "f", rt: 450 }])
    );
    // getMetadata() runs getList() which serializes the description object to a string
    const variableMeasured = meta.getMetadata()["variableMeasured"] as any[];
    const v = variableMeasured.find((e) => e.name === "response");
    expect(v.description).not.toBe("unknown");
    expect(v.description).toMatch(/key the participant pressed/i);
  });

  test("nested plugin: does not throw and still extracts top-level variable descriptions", async () => {
    (global as any).fetch = makeFetch(NESTED_PLUGIN_SOURCE);
    const meta = new JsPsychMetadata();
    // Should complete without throwing
    await expect(
      meta.generate(
        JSON.stringify([{ trial_type: "mock-nested", trial_index: 0, time_elapsed: 100, rt: 800 }])
      )
    ).resolves.not.toThrow();

    const variableMeasured = meta.getMetadata()["variableMeasured"] as any[];
    const rt = variableMeasured.find((e) => e.name === "rt");
    expect(rt.description).toMatch(/reaction time/i);
  });

  test("nested plugin: view_history description is extracted despite nested sub-object", async () => {
    (global as any).fetch = makeFetch(NESTED_PLUGIN_SOURCE);
    const meta = new JsPsychMetadata();
    await meta.generate(
      JSON.stringify([{ trial_type: "mock-nested", trial_index: 0, time_elapsed: 100, view_history: [] }])
    );
    const variableMeasured = meta.getMetadata()["variableMeasured"] as any[];
    const v = variableMeasured.find((e) => e.name === "view_history");
    expect(v.description).not.toBe("unknown");
    expect(v.description).toMatch(/history of pages/i);
  });

  test("non-ok HTTP response: falls back to unknown description without throwing", async () => {
    (global as any).fetch = makeFetch("<html>Not Found</html>", 404);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const meta = new JsPsychMetadata();
    await expect(
      meta.generate(
        JSON.stringify([{ trial_type: "custom-plugin", trial_index: 0, time_elapsed: 100, score: 5 }])
      )
    ).resolves.not.toThrow();

    // Should warn about the missing source, not about a parse error
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Plugin source not found"));
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining("Error parsing"));

    const variableMeasured = meta.getMetadata()["variableMeasured"] as any[];
    expect(variableMeasured.find((e) => e.name === "score")).toBeDefined();
  });
});
