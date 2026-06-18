import { parseCSV, parseJsonData, buildPsychDSDataFiles, deriveFallbackBase } from "@jspsych/metadata";

// Mirrors the CSV branch of DataUpload.runGenerate: parse the uploaded CSV into mainRows and
// hand it to the shared builder. Guards the frontend wiring (the parseCSV call + builder usage)
// that lets an R-style export — with an unnamed row-index column — produce a clean converted
// data/*.csv, without rendering the stateful upload component.
describe("frontend CSV → Psych-DS conversion (the runGenerate path)", () => {
  it("drops an unnamed row-index column from the converted main CSV", async () => {
    const content = ",trial_type,rt\n1,jsPsych-html-keyboard-response,450\n2,jsPsych-html-keyboard-response,512";
    const mainRows = (await parseCSV(content)) as Array<Record<string, unknown>>;

    const built = buildPsychDSDataFiles({
      base: deriveFallbackBase("sub01"),
      mainRows,
      mainContent: content,
    });

    const main = built.find((f) => f.kind === "main")!;
    const header = main.content.split(/\r?\n/)[0].split(",");
    expect(header).not.toContain("");
    expect(header).toEqual(["trial_type", "rt"]);
  });

  it("keeps a well-formed CSV's bytes verbatim", async () => {
    const content = "trial_type,rt\njsPsych-html-keyboard-response,450";
    const mainRows = (await parseCSV(content)) as Array<Record<string, unknown>>;
    const built = buildPsychDSDataFiles({ base: deriveFallbackBase("sub01"), mainRows, mainContent: content });
    expect(built.find((f) => f.kind === "main")!.content).toBe(content);
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
