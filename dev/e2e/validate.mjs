/**
 * E2E verification script for PR #52 (feat/cli): integrate psych-ds validator).
 *
 * Calls psychds-validator directly against two minimal fixtures:
 *   valid-project   — all required fields present; should report 0 errors
 *   invalid-project — @context intentionally omitted; should report ≥1 error
 *
 * This mirrors the logic in packages/cli/src/validatefunctions.ts:validatePsychDS,
 * so running this script confirms that (a) psychds-validator is importable,
 * (b) the valid fixture is genuinely valid, and (c) the invalid fixture is caught.
 *
 * ⚠ Known Windows limitation
 * psychds-validator uses @deno/shim-deno, which causes isDeno to be true even in
 * Node.js. This makes the package use POSIX-only path.join throughout, producing
 * paths like "//dataset_description.json" instead of "/dataset_description.json"
 * on Windows. Pattern matching then fails and every dataset appears invalid.
 * Run this script on macOS/Linux (or in CI) for meaningful results.
 *
 * Usage (from repo root):
 *   node dev/e2e/validate.mjs
 */

import { validate } from 'psychds-validator';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function check(label, datasetPath) {
  console.log(`\n--- ${label} ---`);
  console.log(`    path: ${datasetPath}`);

  let result;
  try {
    result = await validate(datasetPath);
  } catch (err) {
    console.log(`! Could not run validator: ${err.message}`);
    return;
  }

  const errors = [];
  const warnings = [];
  for (const [, issue] of result.issues) {
    if (issue.severity === 'error') errors.push(`${issue.key}: ${issue.reason}`);
    else if (issue.severity === 'warning') warnings.push(`${issue.key}: ${issue.reason}`);
  }

  if (errors.length === 0) {
    console.log(`✔ Passed (${warnings.length} warning(s))`);
  } else {
    console.log(`✘ Failed: ${errors.length} error(s), ${warnings.length} warning(s)`);
    errors.forEach((msg, i) => console.log(`  Error ${i + 1}: ${msg}`));
  }
  if (warnings.length > 0) {
    warnings.forEach((msg, i) => console.log(`  Warning ${i + 1}: ${msg}`));
  }
}

await check('valid-project (expect: 0 errors)',   path.join(__dirname, 'valid-project'));
await check('invalid-project (expect: ≥1 error)', path.join(__dirname, 'invalid-project'));
