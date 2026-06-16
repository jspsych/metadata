import { normalizeDataContent } from "../src/normalizeData";

describe("normalizeDataContent", () => {
  // R's write.csv(row.names=TRUE) prepends an unnamed row-index column, so the header
  // starts with a bare comma -> an empty-string column name.
  test("drops an unnamed leading column from CSV and reports it", async () => {
    const csv = [
      ",trial_type,rt",
      "1,jsPsych-html-keyboard-response,450",
      "2,jsPsych-html-keyboard-response,512",
    ].join("\n");

    const { content, dropped } = await normalizeDataContent(csv, "csv");

    expect(dropped).toEqual([""]);
    const header = content.split(/\r?\n/)[0].split(",");
    expect(header).not.toContain("");
    expect(header).toEqual(["trial_type", "rt"]);
    // Data is preserved, only the row-index column is gone.
    expect(content).toContain("jsPsych-html-keyboard-response,450");
  });

  test("returns well-formed CSV byte-for-byte (nothing dropped)", async () => {
    const csv = "trial_type,rt\njsPsych-html-keyboard-response,450";
    const { content, dropped } = await normalizeDataContent(csv, "csv");
    expect(dropped).toEqual([]);
    expect(content).toBe(csv);
  });

  test("passes JSON through unchanged", async () => {
    const json = JSON.stringify([{ trial_index: 0, rt: 200 }]);
    const { content, dropped } = await normalizeDataContent(json, "json");
    expect(dropped).toEqual([]);
    expect(content).toBe(json);
  });

  test("leaves unparseable CSV untouched rather than throwing", async () => {
    const garbage = '"unterminated,quote\nrow';
    const { content, dropped } = await normalizeDataContent(garbage, "csv");
    expect(dropped).toEqual([]);
    expect(content).toBe(garbage);
  });
});
