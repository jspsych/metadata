import {
  toPsychDSValue,
  isValidPsychDSDataFilename,
  deriveArrayFilename,
  disambiguateArrayFilename,
} from "../src/utils";

/**
 * Stress regression guard for the Psych-DS filename-normalization helpers: throw a battery of
 * nasty inputs (spaces, symbols, unicode, empty, collisions) at the four exported functions and
 * assert (a) their documented output and (b) the core invariant — every name they produce is a
 * fully Psych-DS-compliant data filename. Ported from stress-tests/run-rename.mjs (Pass 1).
 */

describe("toPsychDSValue (stress)", () => {
  // [input, expected]. Runs of non-alphanumerics are word boundaries -> camelCase; inputs with
  // no alphanumerics fall back to "value".
  const cases: [string, string][] = [
    ["mouse_tracking", "mouseTracking"],
    ["RT (ms)", "RTMs"],
    ["snake_case_thing", "snakeCaseThing"],
    ["a.b.c", "aBC"],
    ["  spaced  ", "spaced"],
    ["trailing-", "trailing"],
    ["-leading", "leading"],
    ["CamelCase", "CamelCase"],
    ["simple", "simple"],
    ["123", "123"],
    ["héllo wörld", "hLloWRld"], // non-ASCII letters are boundaries, not kept
    ["👋", "value"],
    ["", "value"],
    ["!!!", "value"],
  ];

  test.each(cases)("toPsychDSValue(%j) -> %j and is a legal value segment", (input, expected) => {
    const got = toPsychDSValue(input);
    expect(got).toBe(expected);
    expect(got).toMatch(/^[a-zA-Z0-9]+$/);
  });

  test("honors a custom fallback when the input has no alphanumerics", () => {
    expect(toPsychDSValue("!!!", "col")).toBe("col");
  });
});

describe("isValidPsychDSDataFilename (stress)", () => {
  const valid = [
    "subject-001_data.csv",
    "subject-nested_measure-rt_data.csv",
    "task-stroop_session-1_data.tsv",
    "a-b_data.csv",
  ];
  const invalid: [string, string][] = [
    ["subject_data.csv", "no keyword-value pair"],
    ["Subject-001_data.csv", "uppercase keyword"],
    ["subject-001_data.json", "wrong extension"],
    ["subject-001.csv", "missing _data"],
    ["_data.csv", "empty base"],
    ["subject-001_measure-_data.csv", "empty value segment"],
    ["sub-1_2-x_data.csv", "second keyword has a digit"],
  ];

  test.each(valid)("accepts %s", (name) => expect(isValidPsychDSDataFilename(name)).toBe(true));
  test.each(invalid)("rejects %s (%s)", (name) => expect(isValidPsychDSDataFilename(name)).toBe(false));
});

describe("deriveArrayFilename (stress)", () => {
  const cases: [string, string, string][] = [
    ["subject-001", "mouse_tracking", "subject-001_measure-mouseTracking_data.csv"],
    ["subject-001", "!!!", "subject-001_measure-col_data.csv"], // unusable column -> "col" fallback
    ["task-stroop_session-1", "RT (ms)", "task-stroop_session-1_measure-RTMs_data.csv"],
    ["subject-001", "héllo", "subject-001_measure-hLlo_data.csv"],
  ];
  test.each(cases)("deriveArrayFilename(%j, %j) -> compliant %j", (base, col, expected) => {
    const got = deriveArrayFilename(base, col);
    expect(got).toBe(expected);
    expect(isValidPsychDSDataFilename(got)).toBe(true);
  });
});

describe("disambiguateArrayFilename (stress)", () => {
  test("appends a separator-less counter on collision, staying Psych-DS valid", () => {
    const base = "subject-001_measure-x_data.csv";
    const used = new Set<string>();
    expect(disambiguateArrayFilename(base, used)).toBe(base);

    used.add(base);
    const second = disambiguateArrayFilename(base, used);
    expect(second).toBe("subject-001_measure-x2_data.csv");

    used.add(second);
    const third = disambiguateArrayFilename(base, used);
    expect(third).toBe("subject-001_measure-x3_data.csv");

    // Counter has no separator, so it stays inside the value segment rather than creating a bad pair.
    expect(isValidPsychDSDataFilename(second)).toBe(true);
    expect(isValidPsychDSDataFilename(third)).toBe(true);
  });

  test("invariant sweep: every derived+disambiguated name from the value battery is valid", () => {
    const columns = ["mouse_tracking", "RT (ms)", "snake_case_thing", "a.b.c", "  spaced  ", "👋", "", "!!!"];
    const used = new Set<string>();
    const offenders: string[] = [];
    for (const col of columns) {
      const finalName = disambiguateArrayFilename(deriveArrayFilename("subject-001", col), used);
      used.add(finalName);
      if (!isValidPsychDSDataFilename(finalName)) offenders.push(`${JSON.stringify(col)} -> ${finalName}`);
    }
    expect(offenders).toEqual([]);
    expect(used.size).toBe(columns.length); // all collisions disambiguated to unique names
  });
});
