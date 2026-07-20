import JsPsychMetadata from "../src/index";
import { VariablesMap, VariableFields } from "../src/VariablesMap";
import { PluginCache } from "../src/PluginCache";
import { objectsToCSV } from "../src/utils";

// Regression tests for the core-library correctness + performance workstream. Each block maps to a
// specific verified bug; the test is the one that would have caught it.

// A plugin source whose `data` block documents `foo`, and an extension source that documents `foo`
// with a distinct string, so we can prove which description was applied.
const PLUGIN_SOURCE = `
const info = <const>{
  name: "mock-plugin",
  parameters: {},
  data: {
    /** Plugin foo description. */
    foo: { type: ParameterType.STRING },
    /** Reaction time in ms. */
    rt: { type: ParameterType.INT },
  },
};
`;
const EXTENSION_SOURCE = `
const info = <const>{
  name: "mouse-tracking",
  parameters: {},
  data: {
    /** Extension foo description. */
    foo: { type: ParameterType.STRING },
  },
};
`;

/** fetch mock that serves the extension source for extension URLs and the plugin source otherwise. */
function makeFetch() {
  return jest.fn().mockImplementation((url: string) => {
    const source = typeof url === "string" && url.includes("extension-") ? EXTENSION_SOURCE : PLUGIN_SOURCE;
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(source) });
  });
}

let warnSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;
beforeEach(() => {
  (global as any).fetch = makeFetch();
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

// ─── B4: extension column handling ─────────────────────────────────────────────
describe("extension_type / extension_version normalization", () => {
  test("CSV-string extension_type ('[\"mouse-tracking\"]') does not crash and applies the extension description", async () => {
    const meta = new JsPsychMetadata();
    await expect(
      meta.generate([
        {
          trial_type: "mock-plugin",
          trial_index: 0,
          extension_type: '["mouse-tracking"]',
          extension_version: '["1.0.0"]',
          foo: "bar",
        },
      ])
    ).resolves.not.toThrow();

    const foo = (meta.getMetadata()["variableMeasured"] as any[]).find((v) => v.name === "foo");
    expect(foo.description).toMatch(/Extension foo description/);
  });

  test("extension_type present but extension_version missing does not throw", async () => {
    const meta = new JsPsychMetadata();
    await expect(
      meta.generate([
        { trial_type: "mock-plugin", trial_index: 0, extension_type: ["mouse-tracking"], foo: "bar" },
      ])
    ).resolves.not.toThrow();
    // The extension description is still applied even without a version.
    const foo = (meta.getMetadata()["variableMeasured"] as any[]).find((v) => v.name === "foo");
    expect(foo.description).toMatch(/Extension foo description/);
  });

  test("single-string extension_type ('mouse-tracking') does not throw", async () => {
    const meta = new JsPsychMetadata();
    await expect(
      meta.generate([
        { trial_type: "mock-plugin", trial_index: 0, extension_type: "mouse-tracking", extension_version: "1.0.0", foo: "bar" },
      ])
    ).resolves.not.toThrow();
    const foo = (meta.getMetadata()["variableMeasured"] as any[]).find((v) => v.name === "foo");
    expect(foo.description).toMatch(/Extension foo description/);
  });
});

// ─── B5: plain-string description via generate() options ────────────────────────
describe("plain-string description in generate() options", () => {
  test("a string description is kept intact (not spread char-by-char)", async () => {
    const meta = new JsPsychMetadata();
    await meta.generate(
      [{ trial_type: "mock-plugin", trial_index: 0, rt: 450 }],
      { variables: { rt: { description: "Reaction time" } } }
    );
    const rt = (meta.getMetadata()["variableMeasured"] as any[]).find((v) => v.name === "rt");
    expect(typeof rt.description).toBe("string");
    expect(rt.description).toContain("Reaction time");
    // Must not have been spread into {"0":"R", ...} — the collapsed value would then be char-joined.
    expect(rt.description).not.toMatch(/^R \| e \| a/);
  });
});

// ─── A1: user-edited default survives getMetadata() when a plugin description exists ───
describe("user-edited default description survives collapse (frontend bug)", () => {
  test("updateVariable(name,'description',{default:'MY TEXT'}) after generate wins in getMetadata()", async () => {
    const meta = new JsPsychMetadata();
    await meta.generate([{ trial_type: "mock-plugin", trial_index: 0, foo: "bar" }]);

    // Plugin description was fetched for foo.
    const before = (meta.getMetadata()["variableMeasured"] as any[]).find((v) => v.name === "foo");
    expect(before.description).toMatch(/Plugin foo description/);

    // The frontend stores user text as { default: userText } via updateVariable.
    meta.updateVariable("foo", "description", { default: "MY TEXT" });

    const after = (meta.getMetadata()["variableMeasured"] as any[]).find((v) => v.name === "foo");
    expect(after.description).toContain("MY TEXT");
  });

  test("a cleared (empty-string) default is dropped like the 'unknown' placeholder — no leading ' | '", async () => {
    const meta = new JsPsychMetadata();
    await meta.generate([{ trial_type: "mock-plugin", trial_index: 0, foo: "bar" }]);

    // A wizard user clearing the description field stores { default: "" }.
    meta.updateVariable("foo", "description", { default: "" });

    const after = (meta.getMetadata()["variableMeasured"] as any[]).find((v) => v.name === "foo");
    expect(after.description).toMatch(/Plugin foo description/);
    expect(after.description).not.toMatch(/^\s*\|/);
  });
});

// ─── A2/A3: getMetadata() is non-mutating and safe to interleave with generate() ───
describe("getMetadata() / getMetadataFields() do not corrupt internal state", () => {
  test("containsMetadataField('author') stays false after getMetadata()", async () => {
    const meta = new JsPsychMetadata();
    await meta.generate([{ trial_type: "mock-plugin", trial_index: 0, foo: "bar" }]);

    expect(meta.containsMetadataField("author")).toBe(false);
    meta.getMetadata();
    expect(meta.containsMetadataField("author")).toBe(false);
    expect(meta.containsMetadataField("variableMeasured")).toBe(false);
  });

  test("getMetadataFields() does not delete keys from the live metadata", () => {
    const meta = new JsPsychMetadata();
    // getMetadata() assembles author/variableMeasured on a fresh object; if getMetadataFields
    // mutated the live object it could strip a legitimately-set field.
    const fields = meta.getMetadataFields();
    expect(fields["author"]).toBeUndefined();
    // The library's own description field is still present after the call.
    expect(meta.getMetadataField("name")).toBe("title");
  });

  test("descriptions are not corrupted when getMetadata() is interleaved with a second generate()", async () => {
    const meta = new JsPsychMetadata();
    const rows = () => [{ trial_type: "mock-plugin", trial_index: 0, foo: "bar" }];

    await meta.generate(rows());
    const first = (meta.getMetadata()["variableMeasured"] as any[]).find((v) => v.name === "foo");
    expect(first.description).toMatch(/Plugin foo description/);

    // Second pass (CLI multi-file flow). The stored per-plugin map must not have been mutated by
    // the previous getMetadata()/getList() call.
    await meta.generate(rows());
    const second = (meta.getMetadata()["variableMeasured"] as any[]).find((v) => v.name === "foo");
    expect(second.description).toMatch(/Plugin foo description/);
    // No re-wrapped / duplicated garbage like "Plugin foo description | Plugin foo description".
    expect(second.description).toBe(first.description);

    // The stored variable still holds an object description (not a collapsed string).
    const stored = meta.getVariable("foo") as VariableFields;
    expect(typeof stored.description).toBe("object");
  });
});

// ─── B6: null observations do not crash generate() ──────────────────────────────
describe("null / non-object observations are skipped", () => {
  test("a null row inside a JSON array is skipped, real rows still processed", async () => {
    const meta = new JsPsychMetadata();
    await expect(
      meta.generate(
        JSON.stringify([
          { trial_type: "mock-plugin", trial_index: 0, rt: 5 },
          null,
          { trial_type: "mock-plugin", trial_index: 1, rt: 9 },
        ])
      )
    ).resolves.not.toThrow();
    const rt = (meta.getMetadata()["variableMeasured"] as any[]).find((v) => v.name === "rt");
    expect(rt).toMatchObject({ value: "number", minValue: 5, maxValue: 9 });
  });

  test("a JSONL `null` line is skipped without crashing", async () => {
    const meta = new JsPsychMetadata();
    const jsonl =
      '{"trial_type":"mock-plugin","trial_index":0,"rt":5}\n' +
      "null\n" +
      '{"trial_type":"mock-plugin","trial_index":1,"rt":9}';
    await expect(meta.generate(jsonl, {}, "json")).resolves.not.toThrow();
    const rt = (meta.getMetadata()["variableMeasured"] as any[]).find((v) => v.name === "rt");
    expect(rt).toMatchObject({ value: "number", minValue: 5, maxValue: 9 });
  });
});

// ─── B7: objectsToCSV escapes header names ──────────────────────────────────────
describe("objectsToCSV header escaping", () => {
  test("a header containing a comma or a quote is quoted/escaped", () => {
    const csv = objectsToCSV([{ "a,b": 1, 'c"d': 2 }], []);
    const [header] = csv.split("\r\n");
    expect(header).toBe('"a,b","c""d"');
  });
});

// ─── B8: numeric coercion only on round-trip ────────────────────────────────────
describe("numeric round-trip coercion", () => {
  function toCSV(rows: Record<string, string>[]): string {
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(",")];
    for (const r of rows) lines.push(headers.map((h) => r[h]).join(","));
    return lines.join("\n");
  }

  test('"007" stays a string level, "0.5" is numeric, a 17-digit id stays a string', async () => {
    const meta = new JsPsychMetadata();
    await meta.generate(
      toCSV([
        { trial_type: "mock-plugin", trial_index: "0", id: "007", ratio: "0.5", big: "12345678901234567" },
        { trial_type: "mock-plugin", trial_index: "1", id: "008", ratio: "0.25", big: "12345678901234568" },
      ]),
      {},
      "csv"
    );
    const vars = new Map((meta.getMetadata()["variableMeasured"] as any[]).map((v) => [v.name, v]));

    expect(vars.get("id").value).toBe("string");
    expect(vars.get("id").levels).toContain("007");
    expect(vars.get("id").minValue).toBeUndefined();

    expect(vars.get("ratio")).toMatchObject({ value: "number", minValue: 0.25, maxValue: 0.5 });

    expect(vars.get("big").value).toBe("string");
    expect(vars.get("big").levels).toContain("12345678901234567");
  });

  test('decimal-fraction literals ("1.0", "450.0", "5.50") are numeric despite failing the round-trip', async () => {
    // R/pandas float exports write trailing-zero decimals; they must land as min/max,
    // not as a categorical level list.
    const meta = new JsPsychMetadata();
    await meta.generate(
      toCSV([
        { trial_type: "mock-plugin", trial_index: "0", rt: "450.0", score: "5.50", neg: "-3.25" },
        { trial_type: "mock-plugin", trial_index: "1", rt: "1.0", score: "5.75", neg: "-1.0" },
      ]),
      {},
      "csv"
    );
    const vars = new Map((meta.getMetadata()["variableMeasured"] as any[]).map((v) => [v.name, v]));

    expect(vars.get("rt")).toMatchObject({ value: "number", minValue: 1, maxValue: 450 });
    expect(vars.get("score")).toMatchObject({ value: "number", minValue: 5.5, maxValue: 5.75 });
    expect(vars.get("neg")).toMatchObject({ value: "number", minValue: -3.25, maxValue: -1 });
  });

  test('identifier protection survives the fraction relaxation ("007.5", "1e3", ".5" stay strings)', async () => {
    const meta = new JsPsychMetadata();
    await meta.generate(
      toCSV([
        { trial_type: "mock-plugin", trial_index: "0", padded: "007.5", exp: "1e3", bare: ".5" },
        { trial_type: "mock-plugin", trial_index: "1", padded: "008.5", exp: "1e4", bare: ".25" },
      ]),
      {},
      "csv"
    );
    const vars = new Map((meta.getMetadata()["variableMeasured"] as any[]).map((v) => [v.name, v]));

    // Leading zeros disqualify even with a fraction; exponent and bare-dot notation
    // stay under the strict round-trip rule.
    expect(vars.get("padded").value).toBe("string");
    expect(vars.get("padded").levels).toContain("007.5");
    expect(vars.get("exp").value).toBe("string");
    expect(vars.get("bare").value).toBe("string");
  });
});

// ─── B9/B10/B11: VariablesMap update-guard fixes ────────────────────────────────
describe("VariablesMap update guards", () => {
  test("updateMinMax initializes only the missing bound when one is pre-set", () => {
    const vars = new VariablesMap();
    vars.setVariable({ "@type": "PropertyValue", name: "x", description: { default: "unknown" }, value: "number", minValue: 5 });

    // Simulate updateFields observing the value 10 (calls minValue then maxValue).
    vars.updateVariable("x", "minValue", 10);
    vars.updateVariable("x", "maxValue", 10);

    const v = vars.getVariable("x") as VariableFields;
    expect(v.minValue).toBe(5); // pre-set bound preserved (old bug overwrote BOTH)
    expect(v.maxValue).toBe(10);
  });

  test("updateName refuses to rename onto an existing name (no silent delete)", () => {
    const vars = new VariablesMap();
    vars.setVariable({ "@type": "PropertyValue", name: "a", description: { default: "unknown" }, value: "string" });
    vars.setVariable({ "@type": "PropertyValue", name: "b", description: { default: "unknown" }, value: "number" });

    vars.updateVariable("a", "name", "b"); // collision → no-op

    expect(vars.containsVariable("a")).toBe(true);
    expect(vars.containsVariable("b")).toBe(true);
    expect((vars.getVariable("b") as VariableFields).value).toBe("number"); // target untouched
  });

  test("updateName refuses an empty name (variable does not vanish)", () => {
    const vars = new VariablesMap();
    vars.setVariable({ "@type": "PropertyValue", name: "a", description: { default: "unknown" }, value: "string" });

    vars.updateVariable("a", "name", "");

    expect(vars.containsVariable("a")).toBe(true);
    expect(vars.getVariableNames()).toContain("a");
  });

  test("updateLevels stringifies booleans and numbers and dedups", () => {
    const vars = new VariablesMap();
    vars.setVariable({ "@type": "PropertyValue", name: "flag", description: { default: "unknown" }, value: "string" });

    vars.updateVariable("flag", "levels", true);
    vars.updateVariable("flag", "levels", false);
    vars.updateVariable("flag", "levels", true); // duplicate
    vars.updateVariable("flag", "levels", 5);

    const v = vars.getVariable("flag") as VariableFields;
    expect(v.levels).toEqual(["true", "false", "5"]);
  });

  test("opt-in levelsCap truncates and warns, but there is no default cap", () => {
    const vars = new VariablesMap();
    vars.setVariable({ "@type": "PropertyValue", name: "c", description: { default: "unknown" }, value: "string" });
    vars.setLevelsCap(2);
    for (const s of ["a", "b", "c", "d"]) vars.updateVariable("c", "levels", s);
    expect((vars.getVariable("c") as VariableFields).levels).toEqual(["a", "b"]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("levelsCap"));
  });
});

// ─── B12: PluginCache keyed on (name, version, isExtension) ──────────────────────
describe("PluginCache cache key", () => {
  test("different versions of the same plugin are cached separately", async () => {
    const cache = new PluginCache();
    (global as any).fetch = jest.fn().mockImplementation((url: string) => {
      const v = url.includes("@2.0.0") ? "version two desc" : "version one desc";
      const src = `const info = { data: { /** ${v} */ foo: { type: X } } };`;
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(src) });
    });

    const r1 = (await cache.getPluginInfo("mock-plugin", "foo", "1.0.0", false)) as any;
    const r2 = (await cache.getPluginInfo("mock-plugin", "foo", "2.0.0", false)) as any;
    expect(r1.description).toMatch(/version one/);
    expect(r2.description).toMatch(/version two/);
  });

  test("a plugin and an extension sharing a name do not collide", async () => {
    const cache = new PluginCache();
    (global as any).fetch = jest.fn().mockImplementation((url: string) => {
      const v = url.includes("extension-") ? "the extension desc" : "the plugin desc";
      const src = `const info = { data: { /** ${v} */ foo: { type: X } } };`;
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(src) });
    });

    const plugin = (await cache.getPluginInfo("shared", "foo", "1.0.0", false, false)) as any;
    const extension = (await cache.getPluginInfo("shared", "foo", "1.0.0", false, true)) as any;
    expect(plugin.description).toMatch(/plugin desc/);
    expect(extension.description).toMatch(/extension desc/);
  });
});

// ─── C14: per-(variable, plugin) description fetch is memoized per generate() call ───
describe("description-fetch memoization", () => {
  test("getPluginInfo is called once per (variable, plugin) pair regardless of row count", async () => {
    const meta = new JsPsychMetadata();
    const spy = jest.spyOn(meta as any, "getPluginInfo");

    await meta.generate([
      { trial_type: "mock-plugin", trial_index: 0, rt: 1, foo: "a" },
      { trial_type: "mock-plugin", trial_index: 1, rt: 2, foo: "b" },
      { trial_type: "mock-plugin", trial_index: 2, rt: 3, foo: "c" },
    ]);

    // Only the two non-system columns (rt, foo) trigger a plugin lookup, once each — not per row.
    expect(spy).toHaveBeenCalledTimes(2);

    // updateFields still ran every row: min/max span all three rows.
    const rt = (meta.getMetadata()["variableMeasured"] as any[]).find((v) => v.name === "rt");
    expect(rt).toMatchObject({ minValue: 1, maxValue: 3 });
  });
});
