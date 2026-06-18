import {
  deriveFallbackBase,
  buildPsychDSDataFiles,
  isValidPsychDSDataFilename,
  stripUnnamedColumns,
} from "../src/utils";

describe("deriveFallbackBase", () => {
  it("turns a stem into a `subject` keyword-value base", () => {
    expect(deriveFallbackBase("sub01")).toBe("subject-sub01");
  });

  it("sanitises non-alphanumeric characters in the stem", () => {
    expect(deriveFallbackBase("subject 1")).toBe("subject-subject1");
    expect(deriveFallbackBase("participant_07")).toBe("subject-participant07");
  });

  it("falls back to a valid value when the stem has no alphanumerics", () => {
    expect(deriveFallbackBase("___")).toBe("subject-file");
  });

  it("always yields a Psych-DS-compliant filename once suffixed", () => {
    for (const stem of ["sub01", "subject 1", "weird!!name", "数据", "___"]) {
      expect(isValidPsychDSDataFilename(`${deriveFallbackBase(stem)}_data.csv`)).toBe(true);
    }
  });
});

describe("buildPsychDSDataFiles", () => {
  it("serialises main rows to a compliant `_data.csv`", () => {
    const out = buildPsychDSDataFiles({
      base: "id-sub01",
      mainRows: [
        { trial_index: 0, rt: 200 },
        { trial_index: 1, rt: 250 },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ filename: "id-sub01_data.csv", kind: "main" });
    expect(isValidPsychDSDataFilename(out[0].filename)).toBe(true);
    // trial_index is a priority column, so it leads the header.
    expect(out[0].content.split("\r\n")[0]).toBe("trial_index,rt");
  });

  it("uses mainContent verbatim instead of serialising rows when provided", () => {
    const csv = "a,b\r\n1,2";
    const out = buildPsychDSDataFiles({ base: "id-sub01", mainRows: [], mainContent: csv });
    expect(out[0].content).toBe(csv);
  });

  it("emits one sidecar per extracted array and object column", () => {
    const out = buildPsychDSDataFiles({
      base: "id-sub01",
      mainRows: [{ trial_index: 0 }],
      extractedArrays: new Map([["mouse_tracking", [{ trial_index: 0, element_index: 0, x: 1 }]]]),
      extractedObjects: new Map([["response", [{ trial_index: 0, correct: true }]]]),
      joinKeys: ["trial_index"],
    });
    const byKind = Object.fromEntries(out.map((f) => [f.kind, f.filename]));
    expect(byKind.main).toBe("id-sub01_data.csv");
    expect(byKind.array).toBe("id-sub01_measure-mouseTracking_data.csv");
    expect(byKind.object).toBe("id-sub01_measure-response_data.csv");
    out.forEach((f) => expect(isValidPsychDSDataFilename(f.filename)).toBe(true));
  });

  it("disambiguates names across calls that share a used-names set", () => {
    const used = new Set<string>();
    const a = buildPsychDSDataFiles({ base: "id-sub", mainRows: [{ trial_index: 0 }], usedArrayFilenames: used });
    const b = buildPsychDSDataFiles({ base: "id-sub", mainRows: [{ trial_index: 0 }], usedArrayFilenames: used });
    expect(a[0].filename).toBe("id-sub_data.csv");
    expect(b[0].filename).toBe("id-sub2_data.csv");
  });

  it("throws rather than emit a non-compliant filename", () => {
    expect(() => buildPsychDSDataFiles({ base: "Bad Base", mainRows: [{ trial_index: 0 }] })).toThrow();
  });
});

describe("stripUnnamedColumns", () => {
  it("removes empty and whitespace-only keys from every row and reports them", () => {
    const rows = [
      { "": "1", " ": "x", trial_index: 0, rt: 200 },
      { "": "2", " ": "y", trial_index: 1, rt: 350 },
    ];
    const { rows: out, dropped } = stripUnnamedColumns(rows);
    expect(dropped.sort()).toEqual(["", " "]);
    expect(out).toBe(rows); // mutates in place, returns same reference
    expect(Object.keys(out[0])).toEqual(["trial_index", "rt"]);
  });

  it("is a no-op (empty dropped list) when all columns are named", () => {
    const rows = [{ trial_index: 0, rt: 200 }];
    const { dropped } = stripUnnamedColumns(rows);
    expect(dropped).toEqual([]);
    expect(Object.keys(rows[0])).toEqual(["trial_index", "rt"]);
  });
});

describe("buildPsychDSDataFiles drops unnamed columns (#109 finding 2)", () => {
  // R's write.csv(row.names=TRUE) prepends an unnamed row-index column. The builder must drop it
  // so the written main CSV matches variableMeasured (generate() drops it from the metadata).
  it("re-serialises a CSV main table without the unnamed column, ignoring verbatim mainContent", () => {
    const rows = [
      { "": "1", trial_type: "x", rt: 450 },
      { "": "2", trial_type: "x", rt: 512 },
    ];
    const built = buildPsychDSDataFiles({
      base: "subject-sub01",
      mainRows: rows,
      mainContent: ",trial_type,rt\n1,x,450\n2,x,512", // dirty verbatim — must NOT be used as-is
    });
    const main = built.find((f) => f.kind === "main")!;
    const header = main.content.split(/\r?\n/)[0].split(",");
    expect(header).not.toContain("");
    expect(header).toEqual(["trial_type", "rt"]);
  });

  it("keeps a clean CSV's mainContent byte-for-byte (nothing dropped)", () => {
    const verbatim = "trial_type,rt\nx,450\nx,512";
    const built = buildPsychDSDataFiles({
      base: "subject-sub01",
      mainRows: [
        { trial_type: "x", rt: 450 },
        { trial_type: "x", rt: 512 },
      ],
      mainContent: verbatim,
    });
    expect(built.find((f) => f.kind === "main")!.content).toBe(verbatim);
  });

  it("drops unnamed columns from JSON-sourced main rows too", () => {
    const built = buildPsychDSDataFiles({
      base: "subject-sub01",
      mainRows: [{ "": "1", trial_index: 0, rt: 1 }],
    });
    const header = built.find((f) => f.kind === "main")!.content.split(/\r?\n/)[0].split(",");
    expect(header).not.toContain("");
  });
});
