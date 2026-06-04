import fs from "fs";
import path from "path";
import { expandHomeDir } from "./utils";
import { validate } from "psychds-validator";

export interface PsychDSValidationResult {
  hasErrors: boolean;
  missingRequiredFields: string[];
  missingRecommendedFields: string[];
}

export function parseMissingFields(issues: Map<string, any>, key: string): string[] {
  const issue = issues.get(key);
  if (!issue) return [];
  const fields = new Set<string>();
  for (const file of issue.files.values()) {
    const evidence: string = (file as any)?.evidence ?? '';
    const match = evidence.match(/\[([^\]]+)\]/);
    if (match) {
      match[1].split(',').map((f: string) => f.trim()).filter(Boolean).forEach(f => fields.add(f));
    } else if (evidence) {
      console.warn(`Warning: could not parse missing fields from validator evidence: ${evidence}`);
    }
  }
  return [...fields];
}

export const validatePsychDS = async (datasetPath: string, verbose: boolean): Promise<PsychDSValidationResult> => {
  // psychds-validator's platform shim uses a POSIX fallback for path.join that calls
  // Array.join("/"), so path.join("/", "file") produces "//file". The validator matches
  // files by exact path (e.g. file.path === "/dataset_description.json"), so the double
  // slash breaks all file lookups. Patch the exported path object to deduplicate consecutive
  // forward slashes. Reaches into an internal module path; guarded by try/catch so
  // validation still runs (with degraded path matching) if the path ever changes.
  try {
    // psychds-validator's exports field blocks subpath imports, so we resolve the main
    // CJS entry point and navigate to platform.js from there. require() with an absolute
    // path hits the module cache, so we get the same object instance that deno.js holds.
    const validatorMain = require.resolve("psychds-validator");
    const platformPath = path.join(path.dirname(validatorMain), "utils", "platform.js");
    const platform = require(platformPath) as any;
    platform.path.join = (...parts: string[]) =>
      (parts as string[]).join('/').replace(/\/+/g, '/') || '/';
  } catch { /* ignore */ }

  let result;
  try {
    result = await validate(path.relative(process.cwd(), datasetPath).replace(/\\/g, '/'));
  } catch (err) {
    console.warn(`\nWarning: Psych-DS validation could not run: ${err instanceof Error ? err.message : err}`);
    return { hasErrors: false, missingRequiredFields: [], missingRecommendedFields: [] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [, issue] of result.issues) {
    if (issue.severity === 'error') errors.push(`${issue.key}: ${issue.reason}`);
    else if (issue.severity === 'warning') warnings.push(`${issue.key}: ${issue.reason}`);
  }

  if (errors.length === 0) {
    console.log(`\n✔ Psych-DS validation passed (${warnings.length} warning${warnings.length !== 1 ? 's' : ''}).`);
  } else {
    console.error(`\n✘ Psych-DS validation failed: ${errors.length} error${errors.length !== 1 ? 's' : ''}, ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}.\n`);
    errors.forEach((msg, i) => console.error(`  Error ${i + 1}: ${msg}`));
  }

  if (verbose && warnings.length > 0) {
    console.warn();
    warnings.forEach((msg, i) => console.warn(`  Warning ${i + 1}: ${msg}`));
  } else if (!verbose && warnings.length > 0) {
    console.warn("  (Rerun with --verbose to see warnings.)");
  }

  return {
    hasErrors: errors.length > 0,
    missingRequiredFields: parseMissingFields(result.issues, 'JSON_KEY_REQUIRED'),
    missingRecommendedFields: parseMissingFields(result.issues, 'JSON_KEY_RECOMMENDED'),
  };
};

// Validating if input is a directory
export const validateDirectory = async (filePath: string): Promise<boolean> => {
  try {
    const expandedPath = expandHomeDir(filePath); // allows for using "~" home directory

    // Resolve the full path to ensure it's an absolute path
    const resolvedPath = path.resolve(expandedPath);
    const stats = await fs.promises.stat(resolvedPath);

    if (!stats.isDirectory()) {
      console.error(`Error: ${resolvedPath} is not a directory`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return false;
  }
}

// Validating if input is a json file 
export const validateJson = (filePath: string, fileName?: string): boolean => {
  try {
    // Expand ~ to the user's home directory
    const expandedPath = expandHomeDir(filePath);

    // Resolve the full path to ensure it's an absolute path
    const resolvedPath = path.resolve(expandedPath);

    // Check if the file exists
    if (!fs.existsSync(resolvedPath)) {
      console.error(`Error: File does not exist at path ${resolvedPath}`);
      return false;
    }

    if (fileName && path.basename(resolvedPath).toLowerCase() !== fileName.toLowerCase()) {
      console.error("File name does not match:", fileName);
      return false;
    }

    // Check if the file has a .json extension
    if (path.extname(resolvedPath).toLowerCase() !== '.json') {
      console.error(`Error: ${resolvedPath} is not a JSON file`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return false;
  }
}
