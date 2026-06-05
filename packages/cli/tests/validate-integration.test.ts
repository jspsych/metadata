import path from "path";
import { validatePsychDS } from "../src/validatefunctions";

/**
 * Integration test against the REAL psychds-validator (no mock).
 *
 * Guards the patch-package fix in patches/psychds-validator+1.5.0.patch, which
 * forces the validator's platform path.join to produce POSIX paths and collapse
 * duplicate slashes. Without it, validate() never initializes the platform, the
 * POSIX fallback turns path.join("/", "x") into "//x", and every file lookup
 * misses — so a valid project wrongly reports MISSING_DATASET_DESCRIPTION /
 * MISSING_DATAFILE on all platforms. `npm ci` applies the patch via the
 * postinstall hook, so this passes in CI and fails if the patch is dropped.
 */
describe("validatePsychDS (integration, real validator)", () => {
  const fixtures = path.resolve(__dirname, "../../../dev/e2e");

  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("a valid Psych-DS project reports no errors", async () => {
    const result = await validatePsychDS(path.join(fixtures, "valid-project"), false);
    expect(result.hasErrors).toBe(false);
  });

  test("an invalid Psych-DS project reports errors", async () => {
    const result = await validatePsychDS(path.join(fixtures, "invalid-project"), false);
    expect(result.hasErrors).toBe(true);
  });
});
