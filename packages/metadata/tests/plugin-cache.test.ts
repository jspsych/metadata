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
        /** The page index in the instructions. */
        page_index: {
          type: ParameterType.INT,
        },
        /** Time spent viewing the page in milliseconds. */
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

  test("nested plugin: descriptions for nested params are extracted when those keys appear as top-level columns", async () => {
    (global as any).fetch = makeFetch(NESTED_PLUGIN_SOURCE);
    const meta = new JsPsychMetadata();
    await meta.generate(
      JSON.stringify([{ trial_type: "mock-nested", trial_index: 0, time_elapsed: 100, page_index: 0, viewing_time: 1200 }])
    );
    const variableMeasured = meta.getMetadata()["variableMeasured"] as any[];

    const pageIndex = variableMeasured.find((e) => e.name === "page_index");
    expect(pageIndex).toBeDefined();
    expect(pageIndex.description).not.toBe("unknown");
    expect(pageIndex.description).toMatch(/page index/i);

    const viewingTime = variableMeasured.find((e) => e.name === "viewing_time");
    expect(viewingTime).toBeDefined();
    expect(viewingTime.description).not.toBe("unknown");
    expect(viewingTime.description).toMatch(/viewing the page/i);
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

    // Should warn about the missing source, not about a parse error.
    // Use mock.calls directly because toHaveBeenCalledWith checks exact argument lists —
    // the "Error parsing" warn takes multiple args, so a single-arg matcher would never match it.
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Plugin source not found"));
    const errorParsingCalled = warnSpy.mock.calls.some((args) =>
      args.some((a) => typeof a === "string" && a.includes("Error parsing"))
    );
    expect(errorParsingCalled).toBe(false);

    const variableMeasured = meta.getMetadata()["variableMeasured"] as any[];
    expect(variableMeasured.find((e) => e.name === "score")).toBeDefined();
  });

  test("plugin source with no data block: returns empty cache and falls back to unknown", async () => {
    const NO_DATA_SOURCE = `
const info = <const>{
  name: "mock-no-data",
  parameters: {},
  citations: '__CITATIONS__',
};
`;
    (global as any).fetch = makeFetch(NO_DATA_SOURCE);
    const meta = new JsPsychMetadata();
    await expect(
      meta.generate(
        JSON.stringify([{ trial_type: "mock-no-data", trial_index: 0, time_elapsed: 100, score: 5 }])
      )
    ).resolves.not.toThrow();

    const variableMeasured = meta.getMetadata()["variableMeasured"] as any[];
    const score = variableMeasured.find((e) => e.name === "score");
    expect(score).toBeDefined();
    expect(score.description).toBe("unknown");
  });
});
