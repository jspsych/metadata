import { compliantBase } from "../src/pages/DataUpload";

// Regression test for PR #103 review: the frontend used to flatten EVERY uploaded
// filename into a single subject-<stem> value, mangling already-compliant CSV names
// (e.g. "sub-01_task-stroop_data.csv" → "subject-sub01taskStroopData_data.csv").
// compliantBase preserves the meaningful base when the upload is already compliant,
// mirroring the CLI's non-rename path.

describe("compliantBase", () => {
  test("preserves the base of an already-compliant CSV upload", () => {
    expect(compliantBase("sub-01_task-stroop_data.csv")).toBe("sub-01_task-stroop");
  });

  test("preserves a single keyword-value compliant name", () => {
    expect(compliantBase("subject-01_data.csv")).toBe("subject-01");
  });

  test("preserves a compliant .tsv upload", () => {
    expect(compliantBase("sub-01_session-a_data.tsv")).toBe("sub-01_session-a");
  });

  test("returns null for a non-compliant CSV (caller falls back to subject-<stem>)", () => {
    // ends in _data.csv but the keyword-value pattern is violated (uppercase keyword, spaces)
    expect(compliantBase("My Data_data.csv")).toBeNull();
  });

  test("returns null for a CSV not ending in _data.csv", () => {
    expect(compliantBase("results.csv")).toBeNull();
  });

  test("returns null for JSON uploads (never a compliant data filename)", () => {
    expect(compliantBase("sub-01_task-stroop.json")).toBeNull();
    expect(compliantBase("data.json")).toBeNull();
  });
});
