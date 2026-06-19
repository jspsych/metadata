import { unwrapTrials } from "@jspsych/metadata";

// DataUpload's JSON path (preflight join-key analysis and the CSV writer) parses uploaded files
// with parseJsonData, which folds in unwrapTrials — so a wrapped { "trials": [...] } export
// (e.g. from OSF) is converted like a bare array instead of being skipped as "not a jsPsych
// trial array". The conversion itself (buildPsychDSDataFiles) is covered end-to-end by the CLI
// suite, which shares this exact helper; here we guard the frontend's contract with the helper —
// that it resolves through the workspace mapping and unwraps exactly the shapes DataUpload depends on.
describe("frontend unwrapTrials integration", () => {
  test("unwraps a { trials: [...] } export so DataUpload treats it as a trial array", () => {
    const parsed = unwrapTrials('{"trials":[{"trial_index":0},{"trial_index":1}]}');
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toEqual([{ trial_index: 0 }, { trial_index: 1 }]);
  });

  test("leaves a bare array unchanged", () => {
    expect(unwrapTrials('[{"trial_index":0}]')).toEqual([{ trial_index: 0 }]);
  });

  test("does NOT unwrap an object with sibling keys (DataUpload still skips it)", () => {
    const parsed = unwrapTrials('{"trials":[{"a":1}],"meta":{"v":2}}');
    expect(Array.isArray(parsed)).toBe(false);
  });
});
