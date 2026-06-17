import JsPsychMetadata from "../src/index";
import { parseJsonData } from "../src/utils";

// JSON-Lines ingestion: several jsPsych labs (and JATOS) export experiment data as
// newline-delimited JSON — one JSON value per line, typically one participant's full
// trial array per line — rather than a single JSON array. generate() / parseJsonData
// must accept both forms and flatten JSONL into one observation stream.

describe("parseJsonData", () => {
  test("returns a standard single JSON array unchanged", () => {
    const rows = [{ a: 1 }, { a: 2 }];
    expect(parseJsonData(JSON.stringify(rows))).toEqual(rows);
  });

  test("parses a pretty-printed (multi-line) single array", () => {
    const rows = [{ a: 1 }, { a: 2 }];
    expect(parseJsonData(JSON.stringify(rows, null, 2))).toEqual(rows);
  });

  test("flattens JSON-Lines where each line is a participant array", () => {
    const p1 = [{ subject: 1, t: 0 }, { subject: 1, t: 1 }];
    const p2 = [{ subject: 2, t: 0 }];
    const jsonl = `${JSON.stringify(p1)}\n${JSON.stringify(p2)}\n`;
    expect(parseJsonData(jsonl)).toEqual([...p1, ...p2]);
  });

  test("handles JSON-Lines where each line is a single object", () => {
    const jsonl = `{"a":1}\n{"a":2}\n{"a":3}`;
    expect(parseJsonData(jsonl)).toEqual([{ a: 1 }, { a: 2 }, { a: 3 }]);
  });

  test("ignores blank lines (incl. CRLF) between records", () => {
    const jsonl = `[{"a":1}]\r\n\r\n[{"a":2}]\r\n`;
    expect(parseJsonData(jsonl)).toEqual([{ a: 1 }, { a: 2 }]);
  });

  test("throws a descriptive error for a malformed JSONL line", () => {
    const jsonl = `[{"a":1}]\nnot json\n[{"a":2}]`;
    expect(() => parseJsonData(jsonl)).toThrow(/line 2 is not valid JSON/);
  });

  test("throws for empty input", () => {
    expect(() => parseJsonData("   \n  ")).toThrow(/empty or not valid/);
  });
});

describe("generate() ingests JSON-Lines end to end", () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn().mockResolvedValue({ text: () => Promise.resolve("") });
  });

  test("builds variableMeasured from a multi-line (per-participant) JSONL export", async () => {
    const p1 = [
      { trial_type: "html-keyboard-response", trial_index: 0, rt: 500, subject: "a" },
      { trial_type: "html-keyboard-response", trial_index: 1, rt: 650, subject: "a" },
    ];
    const p2 = [
      { trial_type: "html-keyboard-response", trial_index: 0, rt: 720, subject: "b" },
    ];
    const jsonl = `${JSON.stringify(p1)}\n${JSON.stringify(p2)}`;

    const meta = new JsPsychMetadata();
    await meta.generate(jsonl, {}, "json");

    const names = meta.getMetadata().variableMeasured.map((v: any) => v.name);
    // A non-system column from the flattened rows is captured...
    expect(names).toContain("rt");
    expect(names).toContain("subject");
    // ...and rt's range spans rows drawn from both participant lines.
    const rt = meta.getVariable("rt") as any;
    expect(rt.minValue).toBe(500);
    expect(rt.maxValue).toBe(720);
  });
});
