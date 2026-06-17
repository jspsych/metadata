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

describe("parseJsonData participant_id tagging", () => {
  // Raw jsPsych exports carry no per-row participant identifier; for multi-participant
  // JSON-Lines the line boundary is the only one available, so tagParticipantId stamps a
  // 0-based participant_id per line. This lets nested array/object extraction form a unique
  // (participant_id, trial_index) join key.
  test("tags a per-line participant_id across JSON-Lines records", () => {
    const p1 = [{ trial_index: 0 }, { trial_index: 1 }];
    const p2 = [{ trial_index: 0 }];
    const jsonl = `${JSON.stringify(p1)}\n${JSON.stringify(p2)}`;
    expect(parseJsonData(jsonl, { tagParticipantId: true })).toEqual([
      { trial_index: 0, participant_id: 0 },
      { trial_index: 1, participant_id: 0 },
      { trial_index: 0, participant_id: 1 },
    ]);
  });

  test("leaves a single JSON array untouched (no line boundaries to tag by)", () => {
    const rows = [{ trial_index: 0 }, { trial_index: 1 }];
    expect(parseJsonData(JSON.stringify(rows), { tagParticipantId: true })).toEqual(rows);
  });

  test("does not overwrite an existing participant_id", () => {
    const jsonl = `[{"participant_id":"P7","trial_index":0}]\n[{"trial_index":0}]`;
    expect(parseJsonData(jsonl, { tagParticipantId: true })).toEqual([
      { participant_id: "P7", trial_index: 0 },
      { trial_index: 0, participant_id: 1 },
    ]);
  });

  test("does not tag when the option is off (default)", () => {
    const jsonl = `[{"trial_index":0}]\n[{"trial_index":0}]`;
    expect(parseJsonData(jsonl)).toEqual([{ trial_index: 0 }, { trial_index: 0 }]);
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

  test("synthesizes participant_id so multi-participant JSON-Lines sidecars join uniquely", async () => {
    // Both participants restart trial_index at 0, so without a participant identifier the two
    // trial-0 view_history rows would collide on (trial_index, element_index).
    const p1 = [{ trial_type: "html-keyboard-response", trial_index: 0, view_history: [{ page: 0 }, { page: 1 }] }];
    const p2 = [{ trial_type: "html-keyboard-response", trial_index: 0, view_history: [{ page: 0 }] }];
    const jsonl = `${JSON.stringify(p1)}\n${JSON.stringify(p2)}`;

    const meta = new JsPsychMetadata();
    await meta.generate(jsonl, {}, "json");

    // participant_id is promoted to the leading join key.
    expect(meta.getArrayJoinKeys()).toEqual(["participant_id", "trial_index"]);

    // It serialises with a plain-text description (not an empty {} that would trip
    // Psych-DS's OBJECT_TYPE_MISSING) that makes its synthetic origin unmistakable, so a
    // downstream user can't mistake it for a real subject ID.
    const pid = meta.getMetadata().variableMeasured.find((v: any) => v.name === "participant_id");
    expect(typeof pid.description).toBe("string");
    expect(pid.description.toLowerCase()).toContain("synthetic");
    expect(pid.description.toLowerCase()).toContain("not a real subject id");

    // Every extracted view_history row carries participant_id, so the composite key is unique.
    const rows = meta.getExtractedArrays().get("view_history") as Array<Record<string, any>>;
    expect(rows.length).toBe(3);
    const keyset = new Set(rows.map((r) => `${r.participant_id}|${r.trial_index}|${r.element_index}`));
    expect(keyset.size).toBe(rows.length);
    expect(rows.map((r) => r.participant_id).sort()).toEqual([0, 0, 1]);
  });

  test("does not relabel a real participant_id already present in the data", async () => {
    // Each line already carries its own participant_id — a real identifier. Promotion should
    // still use it as a join key, but we must not overwrite it with a "synthetic" description
    // (that would misrepresent a genuine subject ID).
    const p1 = [{ trial_type: "html-keyboard-response", trial_index: 0, participant_id: "sub-007" }];
    const p2 = [{ trial_type: "html-keyboard-response", trial_index: 0, participant_id: "sub-008" }];
    const jsonl = `${JSON.stringify(p1)}\n${JSON.stringify(p2)}`;

    const meta = new JsPsychMetadata();
    await meta.generate(jsonl, {}, "json");

    expect(meta.getArrayJoinKeys()).toEqual(["participant_id", "trial_index"]);
    const pid = meta.getMetadata().variableMeasured.find((v: any) => v.name === "participant_id");
    const desc = typeof pid.description === "string" ? pid.description : JSON.stringify(pid.description);
    expect(desc.toLowerCase()).not.toContain("synthetic");
  });

  test("does not promote participant_id for a single-array export that lacks one", async () => {
    const rows = [
      { trial_type: "html-keyboard-response", trial_index: 0, rt: 1 },
      { trial_type: "html-keyboard-response", trial_index: 1, rt: 2 },
    ];
    const meta = new JsPsychMetadata();
    await meta.generate(JSON.stringify(rows), {}, "json");
    expect(meta.getArrayJoinKeys()).toEqual(["trial_index"]);
  });
});
