import { parseCSV, buildPsychDSDataFiles, deriveFallbackBase } from "@jspsych/metadata";

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
