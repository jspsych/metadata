import fs from "fs";
import path from "path";
import JsPsychMetadata, { analyzeJoinKeys, JoinKeyAnalysis, parseCSV, objectsToCSV, isValidPsychDSDataFilename, buildPsychDSDataFiles, PSYCHDS_IGNORE_FILENAME, PSYCHDS_IGNORE_CONTENT } from "@jspsych/metadata";
import { expandHomeDir, disambiguateFilename, fileStem } from "./utils";
import { PlannedFile } from "./rename";

/**
 * Thrown when the data a file produces doesn't match the output-name plan the user approved
 * (a column appears/disappears, or an approved name is already taken). Distinct from an
 * ordinary per-file read/parse failure so it aborts the run loudly instead of being counted
 * as a skipped file — the names on disk must always be the ones the user saw.
 */
export class RenamePlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenamePlanError";
  }
}

export interface GenerateOptions {
  arrayJoinKeys?: string[];
  suppressJoinKeyWarning?: boolean;
  /**
   * Maps an absolute source-file path to its resolved Psych-DS base (the keyword-value
   * sequence before "_data.csv"). Built by the index.ts pre-pass, which prompts for a
   * keyword when a filename is non-compliant. A file missing from the map falls back to
   * its own stem, which is only accepted if it is already Psych-DS-compliant; otherwise
   * the file is skipped (processFile never invents a keyword — that is the pre-pass's job).
   */
  normalizedBases?: Map<string, string>;
  /**
   * Maps an absolute source-file path to its complete, pre-resolved output-name plan (main
   * CSV + one sidecar per extracted column), produced by {@link planRenames} and shown to the
   * user before anything is written. When present, processFile writes exactly these names and
   * throws if the data produces a different set of columns — so the names on disk always match
   * the ones the user approved. Absent for direct/test calls, which fall back to on-the-fly
   * disambiguation.
   */
  renamePlan?: Map<string, PlannedFile>;
}

/**
 * Walks `directoryPath` at the top level and one subdirectory deep, returning every
 * non-directory file with its path. Diagnostics (the "one level deep" warning and
 * directory-read errors) are only emitted when `warn` is true, so the silent pre-passes
 * (`enumerateDataFiles`, `preAnalyzeDirectory`) don't duplicate warnings that
 * `processDirectory` already surfaces on the same directory in the same run.
 */
async function collectDataFiles(
  directoryPath: string,
  { warn = false }: { warn?: boolean } = {}
): Promise<{ files: Array<{ filePath: string; dirPath: string; name: string }>; dirErrors: number } | null> {
  let items: fs.Dirent[];
  try {
    items = await fs.promises.readdir(directoryPath, { withFileTypes: true });
  } catch (err) {
    if (warn) console.error(`Error reading directory ${directoryPath}:`, err);
    return null;
  }

  const files: Array<{ filePath: string; dirPath: string; name: string }> = [];
  let dirErrors = 0;

  for (const item of items) {
    if (item.isDirectory()) {
      const subPath = path.join(directoryPath, item.name);
      try {
        const subItems = await fs.promises.readdir(subPath, { withFileTypes: true });
        for (const subItem of subItems) {
          if (subItem.isDirectory()) {
            if (warn) console.warn("Can only read subdirectories one level deep:", directoryPath);
          } else {
            files.push({ filePath: path.join(subPath, subItem.name), dirPath: subPath, name: subItem.name });
          }
        }
      } catch (err) {
        if (warn) console.error(`Error reading directory ${subPath}:`, err);
        dirErrors += 1;
      }
    } else {
      files.push({ filePath: path.join(directoryPath, item.name), dirPath: directoryPath, name: item.name });
    }
  }

  return { files, dirErrors };
}

/**
 * Reads all data files (JSON or CSV, not dataset_description.json) from a directory,
 * runs a join-key uniqueness analysis on each, and returns the worst-case result
 * (file with the highest duplicateCount). Returns null if no suitable file is found
 * or all files are unique (preserving the caller's "all good" fast path).
 */
export async function preAnalyzeDirectory(
  directoryPath: string,
  initialKeys: string[] = ['trial_index']
): Promise<{ parsedData: Array<Record<string, any>>; analysis: JoinKeyAnalysis; fileName: string } | null> {
  directoryPath = expandHomeDir(directoryPath);

  const collected = await collectDataFiles(directoryPath);
  if (!collected) return null;
  const { files: filePaths } = collected;

  let worst: { parsedData: Array<Record<string, any>>; analysis: JoinKeyAnalysis; fileName: string } | null = null;

  for (const { filePath, name } of filePaths) {
    if (name === 'dataset_description.json') continue;

    const ext = path.extname(name).toLowerCase();
    if (ext !== '.json' && ext !== '.csv') continue;

    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      let parsedData: Array<Record<string, any>>;

      if (ext === '.json') {
        const raw = JSON.parse(content);
        if (!Array.isArray(raw)) continue;
        parsedData = raw as Array<Record<string, any>>;
      } else {
        parsedData = (await parseCSV(content)) as Array<Record<string, any>>;
      }

      const analysis = analyzeJoinKeys(parsedData, initialKeys);
      if (!analysis.isUnique && (worst === null || analysis.duplicateCount > worst.analysis.duplicateCount)) {
        worst = { parsedData, analysis, fileName: name };
      }
    } catch {
      continue;
    }
  }

  return worst;
}

/**
 * Lists candidate data files at the top level and one subdirectory deep, matching
 * processDirectory's traversal depth. Returns absolute-ready { filePath, name } pairs
 * (directories themselves are excluded). Used by the filename-normalization pre-pass.
 */
export async function enumerateDataFiles(directoryPath: string): Promise<Array<{ filePath: string; name: string }>> {
  directoryPath = expandHomeDir(directoryPath);
  const collected = await collectDataFiles(directoryPath);
  return collected ? collected.files : [];
}

/** One source file's extracted-column inventory, in the order processDirectory will write them. */
export interface OutputColumns {
  key: string;
  name: string;
  arrayColumns: string[];
  objectColumns: string[];
}

/**
 * Dry run that discovers, per data file, which array/object columns will be extracted to
 * sidecar CSVs — without writing anything. Runs the same generate() pipeline as
 * processDirectory on a throwaway metadata instance, in the same canonical order (so the
 * results line up with the real run and with {@link planRenames}). The *names* of extracted
 * columns don't depend on the join keys, so the caller's defaults are fine here even before
 * the join-key prompt has run. Used so the interactive preview can show — and reserve names
 * for — sidecars before the user approves a rename.
 */
export async function analyzeOutputColumns(
  directoryPath: string,
  options: GenerateOptions = {}
): Promise<OutputColumns[]> {
  directoryPath = expandHomeDir(directoryPath);
  const collected = await collectDataFiles(directoryPath);
  if (!collected) return [];

  const { files } = collected;
  // dataset_description.json first, mirroring processDirectory so accumulated state matches.
  files.sort((a, b) => {
    if (a.name === 'dataset_description.json') return -1;
    if (b.name === 'dataset_description.json') return 1;
    return 0;
  });

  const metadata = new JsPsychMetadata();
  const result: OutputColumns[] = [];

  for (const { filePath, name } of files) {
    const ext = path.extname(name).toLowerCase();
    if (ext !== '.json' && ext !== '.csv') continue;

    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      if (name === 'dataset_description.json') {
        metadata.loadMetadata(content);
        continue;
      }
      if (ext === '.json') {
        if (!Array.isArray(JSON.parse(content))) continue; // non-array JSON is skipped by the writer too
        await metadata.generate(content, {}, 'json', options);
      } else {
        await metadata.generate(content, {}, 'csv', options);
      }
      result.push({
        key: path.resolve(filePath),
        name,
        arrayColumns: [...metadata.getExtractedArrays().keys()],
        objectColumns: [...metadata.getExtractedObjects().keys()],
      });
    } catch {
      // A file that fails analysis will also fail (with its error) in the real run; here it
      // simply contributes no sidecars to the plan.
      result.push({ key: path.resolve(filePath), name, arrayColumns: [], objectColumns: [] });
    }
  }

  return result;
}

// creating path -> handles the absolute vs non-absolute paths
export const generatePath = (inputPath: string): string => {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  } else {
    return path.resolve(process.cwd(), inputPath);
  }
};

const copyFileWithStructure = async (sourceFilePath: string, verbose: boolean, targetDirectoryPath: string) => {
  try {
    sourceFilePath = expandHomeDir(sourceFilePath);
    targetDirectoryPath = expandHomeDir(targetDirectoryPath);

    const relativePath = path.relative(path.dirname(sourceFilePath), sourceFilePath);
    const targetFilePath = path.join(targetDirectoryPath, relativePath);

    // Ensure the target directory exists
    const targetDir = path.dirname(targetFilePath);
    await fs.promises.mkdir(targetDir, { recursive: true });

    // Copy the file
    await fs.promises.copyFile(sourceFilePath, targetFilePath);
    if (verbose) console.log(`File copied from ${sourceFilePath} to ${targetFilePath}`);
  } catch (error) {
    console.error(`Failed to copy file from ${sourceFilePath} to ${targetDirectoryPath}:`, error);
  }
};

// processing single file, need to refactor this into a seperate call
const processFile = async (metadata: JsPsychMetadata, directoryPath: string, file: string, verbose: boolean, targetDirectoryPath?: string, options: GenerateOptions = {}, usedArrayFilenames: Set<string> = new Set(), usedRawFilenames: Set<string> = new Set()) => {
  const filePath = path.join(directoryPath, file);
  if (verbose) console.log("Reading file:", filePath);

  try {
    const content = await fs.promises.readFile(filePath, "utf8");
    const fileExtension = path.extname(file).toLowerCase();

    switch (fileExtension){
      case '.json':
        if (file === "dataset_description.json") metadata.loadMetadata(content); // need to remove this for the files that are being called with the CLI
        else await metadata.generate(content, {}, 'json', options);
        break;
      case '.csv':
        await metadata.generate(content, {}, 'csv', options);
        break;
      default:
        console.error(`"${file}" is not .csv or .json format.`);
        return false;
    }

    if (targetDirectoryPath) {
      // dataset_description.json takes the loadMetadata() branch above. Copy it through
      // unchanged and skip conversion + array extraction (the latter would re-write the
      // previous data file's array rows under a filename derived from this one).
      if (file === "dataset_description.json") {
        await copyFileWithStructure(filePath, verbose, targetDirectoryPath);
        return true;
      }

      // For JSON sources, parse and validate first so a non-array (or unparseable) file is
      // skipped before it reserves an output name — otherwise it would needlessly disambiguate
      // a later valid file that maps to the same base.
      let parsed: Array<Record<string, any>> | null = null;
      if (fileExtension === '.json') {
        const json = JSON.parse(content);
        if (!Array.isArray(json)) {
          console.error(`"${file}" is not a JSON array of jsPsych trials; skipping CSV conversion.`);
          return false;
        }
        parsed = json;
      }

      // Resolve the Psych-DS base (keyword-value sequence before "_data.csv"). The index.ts
      // pre-pass supplies a base for every source file; fall back to the file's own stem when
      // called directly (e.g. in tests). Never invent a keyword here — if the resolved base
      // would not yield a Psych-DS-compliant filename, skip the file rather than writing an
      // invalid name. The CLI's pre-pass is the single place that prompts to fix such names.
      const key = path.resolve(filePath);
      const planned = options.renamePlan?.get(key);
      const base = options.normalizedBases?.get(key) ?? fileStem(file);
      if (!isValidPsychDSDataFilename(`${base}_data.csv`)) {
        console.error(`"${file}" does not follow the Psych-DS naming pattern ([keyword-value_]+data.csv) and no compliant name was provided; skipping. Run via the CLI (which prompts for a keyword) or supply options.normalizedBases.`);
        return false;
      }

      // Reserve an output name in the directory-wide set, refusing to reuse one. When a
      // rename plan is supplied (the CLI's interactive flow) the names were resolved and
      // shown to the user up front, so a clash here means the plan and the data disagree —
      // fail loudly rather than silently writing a name the user never approved.
      const reserve = (name: string, what: string): string => {
        if (usedArrayFilenames.has(name)) {
          throw new RenamePlanError(
            `Rename-plan collision: "${name}" (${what} for "${file}") is already taken; ` +
            `refusing to overwrite an approved output. The rename plan is out of sync with ` +
            `the data — re-run so the preview reflects it.`
          );
        }
        usedArrayFilenames.add(name);
        return name;
      };

      // Preserve the original JSON under data/raw/ (CSV inputs are already tabular, so they
      // have no separate "raw" form). data/raw/ is flat (one level deep is flattened), so
      // same-named originals from different source subdirectories must be disambiguated or
      // they would overwrite one another.
      if (parsed) {
        const rawDir = path.join(targetDirectoryPath, 'raw');
        await fs.promises.mkdir(rawDir, { recursive: true });
        const rawName = disambiguateFilename(file, usedRawFilenames);
        usedRawFilenames.add(rawName);
        if (rawName !== file) {
          console.log(`  ! raw/"${file}" already exists; saving original as raw/"${rawName}" instead.`);
        }
        await fs.promises.writeFile(path.join(rawDir, rawName), content);
      }

      // Sidecar CSVs: one per array-of-objects column and one per plain-object column
      // detected during generate(). Arrays get element_index in their priority columns;
      // objects get one row per trial (join keys only).
      const extractedArrays = metadata.getExtractedArrays();
      const extractedObjects = metadata.getExtractedObjects();
      const joinKeys = metadata.getArrayJoinKeys();

      if (planned) {
        const priorityCols = [...joinKeys, 'element_index'];

        // With a rename plan, the preview reserved a name for each extracted column up front.
        // Verify — in both directions — that the columns generate() actually produced are exactly
        // the ones the user approved, before writing anything, so an approved run can never write
        // an unapproved (or miss an approved) sidecar.
        const approved = new Set(planned.sidecars.map((s) => `${s.kind}:${s.column}`));
        const produced = new Set([
          ...[...extractedArrays.keys()].map((c) => `array:${c}`),
          ...[...extractedObjects.keys()].map((c) => `object:${c}`),
        ]);
        for (const id of produced) {
          if (!approved.has(id)) {
            throw new RenamePlanError(
              `Rename-plan mismatch for "${file}": column "${id.slice(id.indexOf(':') + 1)}" was ` +
              `extracted but has no approved output name; aborting before writing an unapproved file.`
            );
          }
        }
        for (const id of approved) {
          if (!produced.has(id)) {
            throw new RenamePlanError(
              `Rename-plan mismatch for "${file}": an output name was approved for "${id.slice(id.indexOf(':') + 1)}" ` +
              `but the data did not produce that column; aborting.`
            );
          }
        }

        const resolveSidecar = (kind: 'array' | 'object', colName: string): string => {
          const match = planned.sidecars.find((s) => s.kind === kind && s.column === colName)!;
          return reserve(match.filename, `${kind} sidecar "${colName}"`);
        };

        const mainName = reserve(planned.mainName, 'main output');
        await fs.promises.writeFile(
          path.join(targetDirectoryPath, mainName),
          parsed ? objectsToCSV(parsed, ['trial_index']) : content,
        );
        if (verbose) console.log(`  → wrote ${file} as ${mainName}`);

        for (const [colName, rows] of extractedArrays) {
          const outPath = path.join(targetDirectoryPath, resolveSidecar('array', colName));
          await fs.promises.writeFile(outPath, objectsToCSV(rows, priorityCols), 'utf8');
          if (verbose) console.log(`  → wrote array data for "${colName}" to ${outPath}`);
        }

        for (const [colName, rows] of extractedObjects) {
          const outPath = path.join(targetDirectoryPath, resolveSidecar('object', colName));
          await fs.promises.writeFile(outPath, objectsToCSV(rows, joinKeys), 'utf8');
          if (verbose) console.log(`  → wrote object data for "${colName}" to ${outPath}`);
        }
      } else {
        // Non-interactive path (direct calls/tests): the shared converter owns naming,
        // disambiguation, and CSV building — the same implementation the browser flow uses.
        const built = buildPsychDSDataFiles({
          base,
          mainRows: parsed ?? [],
          mainContent: parsed ? undefined : content,
          extractedArrays,
          extractedObjects,
          joinKeys,
          usedArrayFilenames,
        });
        for (const f of built) {
          await fs.promises.writeFile(path.join(targetDirectoryPath, f.filename), f.content, 'utf8');
          if (verbose) {
            const what = f.kind === 'main' ? `${file} as ${f.filename}` : `${f.kind} data to ${f.filename}`;
            console.log(`  → wrote ${what}`);
          }
        }
      }
    }
  } catch (err) {
    // A plan mismatch means we'd write a name the user never approved — that is not a
    // recoverable "skip this file" condition, so let it abort the whole run.
    if (err instanceof RenamePlanError) throw err;
    console.error(`Error reading file ${file}: ${err} Please ensure this is data generated by JsPsych.`);
    return false;
  }

  return true;
}

// Processing directory recursively up to one level
export const processDirectory = async (metadata: JsPsychMetadata, directoryPath: string, verbose: boolean = false, targetDirectoryPath?: string, options: GenerateOptions = {}) => {
  directoryPath = expandHomeDir(directoryPath);
  let total = 0;
  let failed = 0;
  // Shared across all files so output names are disambiguated against the whole output
  // directory, not just within a single source file: usedArrayFilenames tracks data/ CSVs,
  // usedRawFilenames tracks preserved originals under data/raw/.
  const usedArrayFilenames = new Set<string>();
  const usedRawFilenames = new Set<string>();

  const collected = await collectDataFiles(directoryPath, { warn: true });
  if (collected) {
    const { files, dirErrors } = collected;
    failed += dirErrors;

    // dataset_description.json must be processed first so existing metadata loads before data files
    files.sort((a, b) => {
      if (a.name === 'dataset_description.json') return -1;
      if (b.name === 'dataset_description.json') return 1;
      return 0;
    });

    for (const { dirPath, name } of files) {
      total += 1;
      if (!await processFile(metadata, dirPath, name, verbose, targetDirectoryPath, options, usedArrayFilenames, usedRawFilenames)) failed += 1;
    }

    // When raw originals were preserved under data/raw/, drop a .psychds-ignore at the dataset
    // root so the validator skips them (otherwise FILE_NOT_CHECKED). targetDirectoryPath is the
    // data/ dir, so its parent is the dataset root. Shared definition with the frontend.
    if (usedRawFilenames.size > 0 && targetDirectoryPath) {
      const ignorePath = path.join(path.dirname(targetDirectoryPath), PSYCHDS_IGNORE_FILENAME);
      await fs.promises.writeFile(ignorePath, PSYCHDS_IGNORE_CONTENT, 'utf8');
    }
  } else {
    failed += 1;
  }

  if (failed === 0) console.log(`✔ Reading data files was successful with ${total} files read.`);
  else if (failed !== total) console.log(`? Data files was partially successful with ${(total - failed)}/${total} files read.`);
  else if (failed === total) console.log(`x Data files was unsuccessful with 0 files read. Please try again with valid JsPsych generated data.`);

  return { total, failed };
};

// Processing metadata options json
export const processOptions = async (metadata: JsPsychMetadata, filePath: string, verbose: boolean = false) => {
  try {
    const metadata_options_path = expandHomeDir(generatePath(filePath));
    const data = fs.readFileSync(metadata_options_path, "utf8"); // synchronous read

    if (verbose) console.log("\nmetadata options:", data, "\n"); // log the raw data
    var metadata_options = JSON.parse(data); // parse the JSON data
    
    metadata.updateMetadata(metadata_options);
    console.log(`\n✔ Successfully read and updated metadata according to options file.`);
    return true;
  } catch (error) {
    console.error("Error reading or parsing metadata options:", error);
    return false;
  }
}

export async function saveTextToPath(textstr: string, filePath: string = './file.txt'): Promise<void> {
  filePath = expandHomeDir(filePath);

  try {
    await fs.promises.writeFile(filePath, textstr, 'utf8');
    console.log(`\n✔ File ${filePath} has been saved.`);
  } catch (err) {
    console.error(`\nError writing to file ${filePath}:`, err);
  }
}

// function for loading metadata
export const loadMetadata = async (metadata: JsPsychMetadata, filePath: string) => {
  filePath = expandHomeDir(filePath);
  const fileName = path.basename(filePath).toLowerCase(); // Extract the file name from the filePath

  try {
    const content = await fs.promises.readFile(filePath, "utf8");

    if (fileName === "dataset_description.json"){
      metadata.loadMetadata(content);
      console.log(`\n✔ Successfully loaded previous metadata.\n`);
      return true;
    }
    else console.error("dataset_description.json is not found at path:", filePath);
  } catch (err) {
    console.error(`Error reading file ${fileName}:`, err);
  }

  return false;
}


