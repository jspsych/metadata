import JsPsychMetadata, { unwrapTrials } from "../src/index";

// Some jsPsych exports (e.g. from OSF) wrap the trials array as { "trials": [...] } instead
// of the bare array the pipeline expects. unwrapTrials accepts that exact single-key wrapper
// and returns the array, leaving every other shape untouched so existing Array.isArray gates
// behave as before. It is folded into parseJsonData's fast path, so generate() (and the CLI /
// frontend, which share that parser) accept the wrapper too.
describe("unwrapTrials", () => {
  test("unwraps an exact { trials: [...] } wrapper string", () => {
    const result = unwrapTrials('{"trials":[{"a":1},{"a":2}]}');
    expect(result).toEqual([{ a: 1 }, { a: 2 }]);
  });

  test("returns a bare array string unchanged", () => {
    const result = unwrapTrials('[{"a":1},{"a":2}]');
    expect(result).toEqual([{ a: 1 }, { a: 2 }]);
  });

  test("unwraps an empty trials array to []", () => {
    expect(unwrapTrials('{"trials":[]}')).toEqual([]);
  });

  test("does NOT unwrap when trials is present but not an array", () => {
    expect(unwrapTrials('{"trials":{"a":1}}')).toEqual({ trials: { a: 1 } });
    expect(unwrapTrials('{"trials":5}')).toEqual({ trials: 5 });
  });

  test("does NOT unwrap a wrapper with sibling keys (preserves top-level metadata)", () => {
    const obj = { trials: [{ a: 1 }], meta: { v: 2 } };
    expect(unwrapTrials(JSON.stringify(obj))).toEqual(obj);
  });

  test("returns non-wrapper JSON values unchanged", () => {
    expect(unwrapTrials("null")).toBeNull();
    expect(unwrapTrials("5")).toBe(5);
    expect(unwrapTrials('{"foo":1}')).toEqual({ foo: 1 });
  });

  test("accepts an already-parsed value without double-parsing", () => {
    expect(unwrapTrials({ trials: [{ a: 1 }] })).toEqual([{ a: 1 }]);
    expect(unwrapTrials([{ a: 1 }])).toEqual([{ a: 1 }]);
    expect(unwrapTrials({ foo: 1 })).toEqual({ foo: 1 });
  });

  test("throws on malformed JSON strings", () => {
    expect(() => unwrapTrials("{not json")).toThrow();
  });
});

describe("generate() accepts the { trials: [...] } wrapper", () => {
  // Comparing wrapper vs. bare-array output makes the assertion independent of any plugin
  // description fetch — both runs take the identical path, so any network result cancels out.
  const trials = [
    { trial_type: "survey-text", trial_index: 0, rt: 100, response: "a" },
    { trial_type: "survey-text", trial_index: 1, rt: 200, response: "b" },
  ];

  test("produces the same metadata as the equivalent bare array", async () => {
    const wrapped = new JsPsychMetadata();
    await wrapped.generate(JSON.stringify({ trials }), {}, "json");

    const bare = new JsPsychMetadata();
    await bare.generate(JSON.stringify(trials), {}, "json");

    expect(wrapped.getMetadata()).toEqual(bare.getMetadata());
  });

  test("still throws on a non-array, non-wrapper object", async () => {
    const meta = new JsPsychMetadata();
    await expect(meta.generate('{"trials":{"a":1}}', {}, "json")).rejects.toThrow(
      "Expected an array of observations"
    );
  });
});
