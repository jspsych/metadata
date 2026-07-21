import { parseCSV, parseCSVForWrite, parseJsonData, buildPsychDSDataFiles, deriveFallbackBase } from "@jspsych/metadata";

// Mirrors the CSV branch of DataUpload.runGenerate: parse the uploaded CSV into mainRows via
// parseCSVForWrite (which also reports verbatim-safety) and hand it to the shared builder.
// Guards the frontend wiring (the parse call + builder usage) that lets an R-style export — with
// an unnamed row-index column — produce a clean converted data/*.csv, without rendering the
// stateful upload component.
describe("frontend CSV → Psych-DS conversion (the runGenerate path)", () => {
  it("drops an unnamed row-index column from the converted main CSV", async () => {
    const content = ",trial_type,rt\n1,jsPsych-html-keyboard-response,450\n2,jsPsych-html-keyboard-response,512";
    const { rows: mainRows, verbatimSafe } = await parseCSVForWrite(content);
    const mainContent = verbatimSafe ? content : undefined;

    const built = buildPsychDSDataFiles({
      base: deriveFallbackBase("sub01"),
      mainRows,
      mainContent,
    });

    const main = built.find((f) => f.kind === "main")!;
    const header = main.content.split(/\r?\n/)[0].split(",");
    expect(header).not.toContain("");
    expect(header).toEqual(["trial_type", "rt"]);
  });

  it("keeps a well-formed CSV's bytes verbatim", async () => {
    const content = "trial_type,rt\njsPsych-html-keyboard-response,450";
    const { rows: mainRows, verbatimSafe } = await parseCSVForWrite(content);
    expect(verbatimSafe).toBe(true);
    const built = buildPsychDSDataFiles({
      base: deriveFallbackBase("sub01"),
      mainRows,
      mainContent: verbatimSafe ? content : undefined,
    });
    expect(built.find((f) => f.kind === "main")!.content).toBe(content);
  });

  it("re-serialises (does NOT keep verbatim) a CSV with unescaped quotes in an unquoted field", async () => {
    // jsPsych stimulus HTML written unquoted but containing literal `"`. Writing it verbatim would
    // leave malformed CSV the Psych-DS validator rejects; the wiring must re-serialise it.
    const stimulus = '<div class = "box">hi</div>';
    const content = `trial_type,stimulus,rt\nhtml-keyboard-response,${stimulus},450`;
    const { rows: mainRows, verbatimSafe } = await parseCSVForWrite(content);
    expect(verbatimSafe).toBe(false);

    const built = buildPsychDSDataFiles({
      base: deriveFallbackBase("sub01"),
      mainRows,
      mainContent: verbatimSafe ? content : undefined, // undefined → builder re-serialises
    });
    const main = built.find((f) => f.kind === "main")!.content;
    expect(main).not.toBe(content); // not verbatim
    // The re-serialised output is strictly valid CSV (quotes properly escaped), so it round-trips.
    const reparsed = (await parseCSV(main, { relaxQuotes: false })) as Array<Record<string, unknown>>;
    expect(reparsed[0].stimulus).toBe(stimulus);
  });
});

// Mirrors the JSON branch of DataUpload.runGenerate for a .jsonl upload: the file's `type`
// is normalised to 'json', then parseJsonData flattens the per-line participant arrays into
// mainRows before the shared builder serialises them to one converted data/*.csv.
describe("frontend JSON-Lines → Psych-DS conversion (the runGenerate path)", () => {
  it("flattens a .jsonl export (one participant array per line) into one main CSV", () => {
    const p1 = JSON.stringify([{ trial_type: "html-keyboard-response", rt: 450 }]);
    const p2 = JSON.stringify([{ trial_type: "html-keyboard-response", rt: 512 }]);
    const content = `${p1}\n${p2}\n`;

    const mainRows = parseJsonData(content) as Array<Record<string, unknown>>;
    expect(mainRows).toHaveLength(2);

    const built = buildPsychDSDataFiles({ base: deriveFallbackBase("raw"), mainRows });
    const main = built.find((f) => f.kind === "main")!;
    const lines = main.content.split(/\r?\n/).filter(Boolean);
    expect(lines[0].split(",")).toEqual(["trial_type", "rt"]);
    // Both participant lines became data rows.
    expect(lines).toHaveLength(3);
    expect(main.content).toContain("450");
    expect(main.content).toContain("512");
  });
});
