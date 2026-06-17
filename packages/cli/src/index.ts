#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { input, select, checkbox, Separator } from '@inquirer/prompts';
import JsPsychMetadata, { analyzeJoinKeys, JoinKeyAnalysis, parseCSV, isValidPsychDSDataFilename, toPsychDSValue } from "@jspsych/metadata";
import fs from 'fs';
import path from 'path';
import { processDirectory, processOptions, saveTextToPath, loadMetadata, preAnalyzeDirectory, resolveJoinKeysNonInteractive, enumerateDataFiles, analyzeOutputColumns, OutputColumns, isDataExt } from "./data";
import { validateDirectory, validateJson, validatePsychDS } from './validatefunctions';
import { createDirectoryWithStructure } from './handlefiles';
import { fileStem } from './utils';
import { extractVaryingMiddles, findIdentifierColumn, reduceIdCandidates, sequentialBases, planRenames, PlannedFile, FileColumns, unofficialKeywords, PSYCH_DS_KEYWORDS } from './rename';

// Define a type for the parsed arguments
interface Argv {
  verbose?: boolean;
  'psych-ds-dir'?: string;
  'data-dir'?: string;
  'metadata-options'?: string;
  _: (string | number)[];
  $0: string;
}

// Parse command-line arguments using yargs
const argv = yargs(hideBin(process.argv))
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging',
  })
  .option('psych-ds-dir', {
    alias: 'em',
    type: 'string',
    description: 'Path to an existing Psych-DS directory.',
  })
  .option('data-dir', {
    alias: 'd',
    type: 'string',
    description: 'Path to a data-dir.',
  })
  .option('metadata-options', {
    alias: 'm',
    type: 'string',
    description: 'Path to a metadata-options.json file.',
  })
  .help()
  .argv as Argv;

/**
 * Interactively resolves which join-key columns should be used for extracted array CSVs.
 * Shows a categorised checkbox prompt when trial_index (or other initial keys) are not unique,
 * re-checks after each selection, and offers a "proceed anyway" escape.
 * Returns the final list of join-key column names.
 */
async function promptJoinKeys(
  parsedData: Array<Record<string, any>>,
  initialAnalysis: JoinKeyAnalysis,
  initialKeys: string[],
  fileName: string
): Promise<string[]> {
  let currentKeys = [...initialKeys];
  let analysis = initialAnalysis;

  while (!analysis.isUnique) {
    const keyLabel = currentKeys.join(', ');
    console.log(
      `\n⚠  [${keyLabel}] not unique in "${fileName}": ` +
      `${analysis.duplicateCount} duplicate row${analysis.duplicateCount === 1 ? '' : 's'} found.`
    );
    console.log('   Nested arrays need a unique row ID to be saved as separate CSV files.');
    if (analysis.duplicateValues.length > 0) {
      console.log(
        '   Example duplicates: ' +
        analysis.duplicateValues.slice(0, 3).map(v => JSON.stringify(v)).join(', ')
      );
    }
    if (analysis.suggestedAdditionalKeys && analysis.suggestedAdditionalKeys.length > 0) {
      console.log(`   Suggested addition: [${analysis.suggestedAdditionalKeys.join(', ')}]`);
    }

    if (analysis.candidates.length === 0) {
      console.log('   No candidate columns found — the data may contain genuinely duplicate rows.');
      break;
    }

    const sufficient = analysis.candidates.filter(c => c.makesUnique && c.column !== '__proceed__');
    const insufficient = analysis.candidates.filter(c => !c.makesUnique && c.column !== '__proceed__');

    type Choice = { name: string; value: string; checked: boolean };
    const choices: Array<Choice | Separator> = [];
    if (sufficient.length > 0) {
      choices.push(new Separator('── Sufficient alone ──'));
      for (const c of sufficient) {
        choices.push({ name: c.column, value: c.column, checked: true });
      }
    }
    if (insufficient.length > 0) {
      choices.push(new Separator('── Reduces duplicates ──'));
      for (const c of insufficient) {
        choices.push({ name: c.column, value: c.column, checked: false });
      }
    }
    choices.push(new Separator());
    choices.push({
      name: 'Proceed anyway (extracted CSVs may have duplicate rows)',
      value: '__proceed__',
      checked: false,
    });

    const selected: string[] = await checkbox({
      message: 'Select additional join-key columns for extracted array CSVs:',
      choices,
    });

    if (selected.includes('__proceed__')) break;

    const additionalKeys = selected.filter(s => s !== '__proceed__');
    if (additionalKeys.length === 0) {
      console.log('   No columns selected. Select at least one column or choose "Proceed anyway".');
      continue;
    }

    currentKeys = [...currentKeys, ...additionalKeys];
    analysis = analyzeJoinKeys(parsedData, currentKeys);

    if (analysis.isUnique) {
      console.log(`✔ [${currentKeys.join(', ')}] uniquely identifies all rows.`);
    }
  }

  return currentKeys;
}

async function metadataOptionsPrompt(metadata: JsPsychMetadata, verbose: boolean){
  const answer = await select({
    message: 'Would you like to customize the metadata?',
    choices: [
      {
        name: 'Use defaults',
        value: false,
        description: 'You can always edit dataset_description.json directly or re-run this CLI later.',
      },
      {
        name: 'Use a custom metadata file',
        value: true,
        description: 'Use a .json file that follows the Psych-DS and jsPsych metadata specifications to override generated metadata (authors, variable descriptions, etc.).',
      },
    ],
  });

  var optionsPath: string = "";

  if (answer){
    optionsPath = await input({
      message: 'Path to metadata options .json file:',
      validate: async (input) => {
        if (validateJson(input)) return true;
        return "File not found or not valid JSON — check the path and try again.";
      }
    });

    await processOptions(metadata, optionsPath, verbose);
  }

  return optionsPath;

}

const promptProjectStructure = async (metadata: JsPsychMetadata) => {
  const answer = await select({
    message: 'What would you like to do?',
    choices: [
      {
        name: 'Create a new project',
        value: 'generate',
        description: 'Create a Psych-DS project from your data.',
      },
      {
        name: 'Update an existing project',
        value: 'update',
        description: 'Refresh metadata for a previously generated Psych-DS project.',
      },
    ],
  });

  let project_path: string = "";

  try {
    switch(answer){
      case "generate":
        project_path = await input({
          message: 'Path to the folder where the new project will be created:',
          validate: async (input) => {
            if (await validateDirectory(input)) return true;
            return "Not a valid folder — check the path and try again.";
          }
        });
        return [project_path, true];
      case "update":
        project_path = await input({
          message: 'Path to existing project folder (must contain dataset_description.json):',
          validate: async (input) => {
            try {
              if (await validateDirectory(input) && await validateJson(input + "/dataset_description.json", "dataset_description.json")){
                return true;
              }
              return "This folder is not a valid Psych-DS project (dataset_description.json not found). Please enter the path to an existing Psych-DS project folder.";
            } catch (err) {
              console.error(err);
              return "This folder is not a valid Psych-DS project (dataset_description.json not found). Please enter the path to an existing Psych-DS project folder.";
            }
          }
        });

        await loadMetadata(metadata, project_path + "/dataset_description.json");

        return [project_path, false];
    }
  } catch (err){ } // should be no errors

  return project_path;
}

// should only do if generating 
const promptName = async () => {
  const project_name = await input({
    message: 'Enter the project name (used as the folder name and in the metadata):'
  });

  return project_name;
}

const promptDataDir = async (): Promise<string> => {
  return input({
    message: 'Path to your raw data folder (files will be copied, not moved):',
    validate: async (input) => {
      if (await validateDirectory(input)) return true;
      return "Not a valid folder — check the path and try again.";
    }
  });
}

const SYSTEM_VARIABLE_NAMES = new Set([
  "trial_type",
  "trial_index",
  "time_elapsed",
  "extension_type",
  "extension_version",
]);

function hasUnknownDescription(variable: any): boolean {
  const desc = variable["description"];
  if (!desc) return false;
  if (typeof desc === "string") return desc === "unknown";
  if (typeof desc === "object") {
    const values = Object.values(desc) as string[];
    return values.length > 0 && values.every((v) => v === "unknown");
  }
  return false;
}

const promptUnknownDescriptions = async (metadata: JsPsychMetadata) => {
  const unknownVars = metadata.getVariableNames().filter((name) => {
    if (SYSTEM_VARIABLE_NAMES.has(name)) return false;
    return hasUnknownDescription(metadata.getVariable(name));
  });

  if (unknownVars.length === 0) return;

  const fillIn = await select({
    message: `${unknownVars.length} variable(s) have unknown descriptions. Would you like to fill them in?`,
    choices: [
      {
        name: "Fill in descriptions",
        value: true,
        description: "You will be prompted for each variable. Press Enter to skip individual ones.",
      },
      {
        name: "Skip",
        value: false,
        description: "Leave descriptions as unknown in the dataset_description.json.",
      },
    ],
  });

  if (!fillIn) return;

  for (const name of unknownVars) {
    const description = await input({
      message: `Description for "${name}" (press Enter to skip):`,
    });

    if (description.trim()) {
      // updateVariable's "description" handling is append-only — it accumulates
      // descriptions across plugins rather than overwriting. Clear the existing
      // "unknown" entry first so the user's value replaces it instead of sitting
      // alongside the stale "unknown".
      const variable = metadata.getVariable(name) as { description?: Record<string, string> };
      variable.description = {};
      metadata.updateVariable(name, "description", { user: description.trim() });
    }
  }
};

/** Prompts for a Psych-DS keyword: official ones from a list (PSYCH_DS_KEYWORDS, the same
 * set unofficialKeywords() checks against), or a custom (warning-emitting) one. */
async function promptKeyword(): Promise<string> {
  const CUSTOM = '__custom__';
  let keyword = await select({
    message: 'Choose a Psych-DS keyword to label these files:',
    choices: [
      ...PSYCH_DS_KEYWORDS,
      new Separator(),
      { name: 'Other (custom keyword)', value: CUSTOM, description: 'Unofficial keywords are allowed but emit a validator warning.' },
    ],
  });

  if (keyword === CUSTOM) {
    keyword = await input({
      message: 'Custom keyword (lowercase letters only):',
      validate: (v) => /^[a-z]+$/.test(v) ? true : 'Keyword must be one or more lowercase letters (a–z) — no digits, spaces, or symbols.',
    });
  }
  return keyword;
}

/**
 * Parses a data file into rows for the "read ID from the data" strategy.
 * Returns null when the file is unparseable or a JSON file is not an array —
 * the strategy is simply not offered in that case, never a hard error.
 */
async function parseDataRows(filePath: string): Promise<Array<Record<string, any>> | null> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    if (path.extname(filePath).toLowerCase() === '.json') {
      const raw = JSON.parse(content);
      return Array.isArray(raw) ? (raw as Array<Record<string, any>>) : null;
    }
    return (await parseCSV(content)) as Array<Record<string, any>>;
  } catch {
    return null;
  }
}

/**
 * Validates a proposed Psych-DS base (the keyword-value sequence before "_data.csv").
 * Shared by every prompt that accepts a base, so the rule and its error message live
 * in one place.
 */
const validateBase = (v: string): true | string =>
  isValidPsychDSDataFilename(`${v}_data.csv`)
    ? true
    : 'Must be one or more keyword-value pairs joined by "_" (keyword: lowercase letters; value: letters/digits), e.g. subject-001_session-2.';

/** Maps each file to the base computed by `baseFor`, keyed by absolute source path. */
function buildProposals(
  files: Array<{ filePath: string; name: string }>,
  baseFor: (f: { filePath: string; name: string }, i: number) => string
): Map<string, string> {
  const proposals = new Map<string, string>();
  files.forEach((f, i) => proposals.set(path.resolve(f.filePath), baseFor(f, i)));
  return proposals;
}

interface RenameStrategy {
  /** Menu label, including an example rename of the first file. */
  name: string;
  value: string;
  description: string;
  /** Computes proposed bases (path → base). May prompt (e.g. for a keyword). */
  propose: () => Promise<Map<string, string>>;
}

/**
 * Builds the list of rename strategies applicable to the given non-compliant
 * files. The fallback strategy (keyword + full stem as the value) is always
 * present; the smarter ones are offered only when they apply to *every* file,
 * so a strategy choice never leaves some files unhandled.
 */
async function buildRenameStrategies(
  nonCompliant: Array<{ filePath: string; name: string }>
): Promise<RenameStrategy[]> {
  const strategies: RenameStrategy[] = [];

  // Sample preview rendered under the highlighted menu option: old → new for
  // the first few files, so the choice can be judged on real names instead of
  // a single abstract example.
  const sampleFiles = nonCompliant.slice(0, 3);
  const remaining = nonCompliant.length - sampleFiles.length;
  const samplePreview = (baseFor: (f: { filePath: string; name: string }, i: number) => string): string => {
    const lines = sampleFiles.map((f, i) => `      ${f.name} → ${baseFor(f, i)}_data.csv`);
    if (remaining > 0) lines.push(`      … and ${remaining} more`);
    return lines.join('\n');
  };

  // 1. Read ID from the data: an identifier column with one unique value per file.
  // The most reliable option — the name comes from the data itself, not the old filename.
  // Process one file at a time so full row arrays can be GC'd before reading the next;
  // reduceIdCandidates keeps only capped per-column unique-value sets, bounding memory
  // to one file's rows. Large datasets make this scan take a few seconds, hence the
  // progress log.
  console.log(`\nScanning ${nonCompliant.length} data file(s) for identifier columns…`);
  const uniquesByFile = new Map<string, Map<string, Set<string>>>();
  for (const { filePath } of nonCompliant) {
    const rows = await parseDataRows(filePath);
    if (!rows) break;
    const colUniques = reduceIdCandidates(rows);
    // A column qualifies only when it has exactly one unique value in *every* file,
    // so a file where no ID column qualifies rules the strategy out dataset-wide —
    // stop scanning and skip parsing the remaining files entirely.
    if (![...colUniques.values()].some((unique) => unique.size === 1)) break;
    uniquesByFile.set(path.resolve(filePath), colUniques);
  }
  if (uniquesByFile.size === nonCompliant.length) {
    const id = findIdentifierColumn(uniquesByFile);
    if (id) {
      strategies.push({
        name: `Use the "${id.column}" value found inside each file`,
        value: 'data-id',
        description:
          `Most reliable: the ID is read from the data itself, so it works even when the old filenames are meaningless.\n` +
          samplePreview((f) => `subject-${toPsychDSValue(id.values.get(path.resolve(f.filePath))!)}`),
        propose: async () => {
          const proposals = new Map<string, string>();
          for (const [filePath, value] of id.values) {
            proposals.set(filePath, `subject-${toPsychDSValue(value)}`);
          }
          return proposals;
        },
      });
    }
  }

  // 2. Pattern extraction: shared prefix/suffix stripped, varying middle becomes the value.
  const pattern = extractVaryingMiddles(nonCompliant.map((f) => fileStem(f.name)));
  if (pattern) {
    const shared = `"${pattern.prefix}"${pattern.suffix ? ` and "${pattern.suffix}"` : ''}`;
    strategies.push({
      name: 'Keep only the part that differs between the filenames',
      value: 'pattern',
      description:
        `All the filenames share ${shared}; the part in between becomes the value. <keyword> is the keyword you'll pick next.\n` +
        samplePreview((f) => `<keyword>-${toPsychDSValue(pattern.middles.get(fileStem(f.name))!)}`),
      propose: async () => {
        const keyword = await promptKeyword();
        return buildProposals(nonCompliant, ({ name }) => `${keyword}-${toPsychDSValue(pattern.middles.get(fileStem(name))!)}`);
      },
    });
  }

  // 3. Sequential labels: the user names the first file (e.g. subject-001) and
  // the rest continue the numbering, in the order the files are listed. Useful
  // when the real IDs are long/messy — the ID column inside the data and the
  // originals under data/raw/ keep the mapping, so nothing is lost.
  strategies.push({
    name: 'Give the files fresh numbered names (subject-001, subject-002, …)',
    value: 'sequence',
    description:
      `Replaces messy names with clean numbers, in the order listed — you'll type the first name next (preview shows the default). ` +
      `Any ID column inside the data is untouched and the originals are kept under data/raw/, so the mapping survives.\n` +
      samplePreview((_f, i) => sequentialBases('subject-001', nonCompliant.length)![i]),
    propose: async () => {
      const example = await input({
        message: 'Name for the first file (the part before "_data.csv", must end in a number):',
        default: 'subject-001',
        validate: (v) => {
          const valid = validateBase(v);
          if (valid !== true) return valid;
          if (!/\d$/.test(v)) return 'Must end in a number so the remaining files can continue the sequence.';
          return true;
        },
      });
      const labels = sequentialBases(example, nonCompliant.length)!;
      return buildProposals(nonCompliant, (_f, i) => labels[i]);
    },
  });

  // 4. Fallback: the whole stem becomes the value under one prompted keyword.
  // (No regex/custom-rule option on purpose: individual names can be hand-edited
  // in the preview step, which covers the odd cases without regex knowledge.)
  strategies.push({
    name: 'Keep the whole old filename as the value',
    value: 'stem',
    description:
      `Safe but verbose: nothing from the old name is lost, it's just squashed into one value. <keyword> is the keyword you'll pick next.\n` +
      samplePreview((f) => `<keyword>-${toPsychDSValue(fileStem(f.name))}`),
    propose: async () => {
      const keyword = await promptKeyword();
      return buildProposals(nonCompliant, ({ name }) => `${keyword}-${toPsychDSValue(fileStem(name))}`);
    },
  });

  // Mark the best available automatic strategy as recommended. data-id (already
  // first when present) beats pattern; the manual options are never recommended.
  const recommended = strategies.find((s) => s.value === 'data-id') ?? strategies.find((s) => s.value === 'pattern');
  if (recommended) recommended.name += '   (recommended)';

  return strategies;
}

/**
 * Pre-pass: resolves a Psych-DS-compliant base (the keyword-value sequence before "_data.csv")
 * for every data file in `dataDir`. Already-compliant filenames keep their base — except ones
 * using unofficial keywords (e.g. "data-xyz"), which are legal but draw a validator warning;
 * those get an opt-in to join the rename flow. Non-compliant ones must go through it: pick a
 * strategy (ID column from the data, pattern extraction, sequential labels, or keyword + full
 * stem), review the full old → new
 * preview (collisions are flagged and auto-disambiguated), then apply, edit individual names,
 * or switch strategy. Returns a map of absolute source path → base.
 *
 * When `canPrompt` is false (non-interactive run), a non-compliant filename is a hard error —
 * we never silently invent a keyword.
 */
interface FilenameNormalization {
  /** Resolved source path → chosen Psych-DS base (keyword-value sequence). */
  bases: Map<string, string>;
  /**
   * Complete approved output-name plan (main + sidecars) when a rename happened, else null.
   * When non-null it is the single source of truth the writer must honor exactly.
   */
  plan: Map<string, PlannedFile> | null;
}

async function resolveFilenameNormalization(
  dataDir: string,
  canPrompt: boolean,
  columns: OutputColumns[]
): Promise<FilenameNormalization> {
  const files = await enumerateDataFiles(dataDir);
  const bases = new Map<string, string>();
  const nonCompliant: Array<{ filePath: string; name: string }> = [];
  const unofficial: Array<{ filePath: string; name: string; keywords: string[] }> = [];

  // Extracted-column inventory per file, used to show (and reserve names for) sidecars in
  // the preview. Files in `columns` are in the writer's canonical order.
  const columnsByKey = new Map(columns.map((c) => [c.key, c]));

  for (const { filePath, name } of files) {
    if (name === 'dataset_description.json') continue;
    const ext = path.extname(name).toLowerCase();
    if (!isDataExt(ext)) continue;

    const stem = fileStem(name);
    if (!isValidPsychDSDataFilename(`${stem}_data.csv`)) {
      nonCompliant.push({ filePath, name });
      continue;
    }
    const offKeywords = unofficialKeywords(stem);
    if (offKeywords.length > 0 && canPrompt) {
      // Legal name, but the validator will warn about the keyword(s) — offer a rename.
      unofficial.push({ filePath, name, keywords: offKeywords });
    } else {
      bases.set(path.resolve(filePath), stem);
    }
  }

  if (!canPrompt && nonCompliant.length > 0) {
    const fileList = nonCompliant.map((f) => `    ${f.name}`).join('\n');
    console.error(
      `\n✘ ${nonCompliant.length} data file(s) do not follow the Psych-DS naming pattern ` +
      `([keyword-value_]+data.csv), and this is a non-interactive run:\n${fileList}\n` +
      `  Rename them to a compliant name (e.g. subject-001_data.csv) and re-run.`
    );
    process.exit(1);
  }

  if (nonCompliant.length > 0) {
    console.log(
      `\n${nonCompliant.length} data file(s) do not follow the Psych-DS naming pattern ` +
      `([keyword-value_]+data.csv):\n${nonCompliant.map((f) => `    ${f.name}`).join('\n')}`
    );
  }

  if (unofficial.length > 0) {
    console.log(
      `\n${unofficial.length} data file(s) have technically valid names that use unofficial ` +
      `keywords (the validator warns about these):\n` +
      unofficial.map((f) => `    ${f.name}  (keyword: ${f.keywords.join(', ')})`).join('\n')
    );
    const renameThem = await select({
      message: 'Rename these files too?',
      choices: [
        {
          name: 'Yes, rename them — suggested naming strategies will be provided',
          value: true,
          description: 'You will pick from suggested strategies and see a preview of every rename before anything is written.',
        },
        { name: 'No, keep their current names', value: false, description: 'Legal names — the validator will emit a warning per file.' },
      ],
    });
    if (renameThem) {
      nonCompliant.push(...unofficial.map(({ filePath, name }) => ({ filePath, name })));
    } else {
      for (const { filePath, name } of unofficial) {
        bases.set(path.resolve(filePath), fileStem(name));
      }
    }
  }

  if (nonCompliant.length === 0) return { bases, plan: null };

  const strategies = await buildRenameStrategies(nonCompliant);

  // Builds the complete output-name plan for the whole directory from the current proposed
  // bases. Every output file is included (already-compliant ones too) and listed in the
  // writer's canonical order, so collisions between a renamed file's main name and another
  // file's sidecar are resolved here exactly as they will be on disk.
  const buildPlan = (proposals: Map<string, string>): Map<string, PlannedFile> => {
    const ordered: FileColumns[] = [];
    for (const { key, arrayColumns, objectColumns } of columns) {
      const base = proposals.get(key) ?? bases.get(key);
      if (base === undefined) continue; // not a resolved output file
      ordered.push({ key, base, arrayColumns, objectColumns });
    }
    return planRenames(ordered);
  };

  while (true) {
    const chosen = await select({
      message: 'How should these files be renamed?',
      choices: strategies.map(({ name, value, description }) => ({ name, value, description })),
    });
    const proposals = await strategies.find((s) => s.value === chosen)!.propose();

    // Preview / edit loop: show every rename (with the sidecar CSVs each will generate),
    // then apply, edit one, or go back.
    while (true) {
      const plan = buildPlan(proposals);
      console.log('\nProposed renames:');
      for (const { filePath, name } of nonCompliant) {
        const planned = plan.get(path.resolve(filePath))!;
        const flag = planned.mainAdjusted ? '  (adjusted to avoid a name collision)' : '';
        console.log(`    ${name} → ${planned.mainName}${flag}`);
        for (const s of planned.sidecars) {
          const sflag = s.adjusted ? '  (adjusted to avoid a name collision)' : '';
          console.log(`        + ${s.filename}  (${s.kind} column "${s.column}")${sflag}`);
        }
      }

      const action = await select({
        message: 'Apply these names?',
        choices: [
          { name: 'Apply', value: 'apply' },
          { name: 'Edit one filename', value: 'edit' },
          { name: 'Choose a different strategy', value: 'back' },
        ],
      });

      if (action === 'apply') {
        // Record each renamed file's chosen base; the writer derives final names from `plan`.
        for (const [filePath, base] of proposals) bases.set(filePath, base);
        return { bases, plan };
      }

      if (action === 'back') break;

      const target = await select({
        message: 'Which file?',
        choices: nonCompliant.map(({ filePath, name }) => ({
          name: `${name} → ${plan.get(path.resolve(filePath))!.mainName}`,
          value: path.resolve(filePath),
        })),
      });
      const edited = await input({
        message: 'New name (the part before "_data.csv", e.g. subject-001):',
        default: proposals.get(target),
        validate: validateBase,
      });
      proposals.set(target, edited);
    }
  }
}

// can seperate the process argv's out into seperate function
const main = async () => {
  const verbose = argv.verbose ? argv.verbose : false;
  const metadata = new JsPsychMetadata(verbose);

  var project_path, new_project;

  if (argv['psych-ds-dir'] 
    && await validateDirectory(argv['psych-ds-dir']) 
    && await validateJson(argv['psych-ds-dir'] + "/dataset_description.json", "dataset_description.json")){  
      project_path = argv['psych-ds-dir'];
      new_project = false;
      await loadMetadata(metadata, project_path + "/dataset_description.json"); // maybe shoudl add verbose
      // NOTE: we intentionally do NOT validate here. At this point the data files have not been
      // copied into the project yet, so validation would always fail with MISSING_DATA_DIRECTORY
      // and print a misleading "✘ validation failed" to stderr. The real validation runs after the
      // data is written (see below).
      if (verbose) console.log(`\n\n-------------------------- Reading existing metadata --------------------------\n\n${JSON.stringify(metadata.getMetadata(), null, 2)}`);
  }
  else {
    [ project_path, new_project ] = await promptProjectStructure(metadata);
  }

  if (new_project) {
    const project_name = await promptName();
    project_path = `${project_path}/${project_name}`;
    createDirectoryWithStructure(project_path); // May want to include this with project_name therefore will prevent errors
    metadata.setMetadataField("name", project_name); // same as above
  }

  // Determine data directory path (from flag or interactive prompt)
  let dataDir: string;
  if (argv['data-dir'] && await validateDirectory(argv['data-dir'])) {
    dataDir = argv['data-dir'];
  } else {
    dataDir = await promptDataDir();
  }

  const isNonInteractive = !!(
    argv['psych-ds-dir'] && await validateDirectory(argv['psych-ds-dir']) &&
    argv['data-dir'] && await validateDirectory(argv['data-dir']) &&
    argv['metadata-options'] && validateJson(argv['metadata-options'])
  );

  if (verbose) console.log("\n\n-------------------------- Reading and writing data files --------------------------\n\n");

  // Dry run: discover which array/object columns each file will extract to sidecar CSVs, so
  // the rename preview can show every output name (main + sidecars). Column names don't depend
  // on the join keys, so the defaults are fine before the join-key prompt below.
  const outputColumns = await analyzeOutputColumns(dataDir, { arrayJoinKeys: ['trial_index'] });

  // Pre-pass: resolve Psych-DS-compliant output names, prompting once for any non-compliant
  // filenames. Without an interactive terminal we cannot prompt, so this fails rather than
  // inventing a keyword. When a rename happens this also returns the complete, approved
  // output-name plan the writer must honor exactly.
  const canPrompt = !isNonInteractive && !!process.stdin.isTTY && !!process.stdout.isTTY;
  const { bases: normalizedBases, plan: renamePlan } = await resolveFilenameNormalization(dataDir, canPrompt, outputColumns);

  // Pre-flight: check whether default join key (trial_index) is unique. If not, prompt the user
  // when we have a terminal; otherwise (fully-flagged headless run) resolve deterministically so
  // the run never blocks on an interactive prompt it can't answer.
  const initialKeys = ['trial_index'];
  const preResult = await preAnalyzeDirectory(dataDir, initialKeys);
  let arrayJoinKeys = initialKeys;
  if (preResult && !preResult.analysis.isUnique) {
    if (canPrompt) {
      arrayJoinKeys = await promptJoinKeys(preResult.parsedData, preResult.analysis, initialKeys, preResult.fileName);
    } else {
      const resolved = resolveJoinKeysNonInteractive(preResult.analysis, initialKeys, preResult.fileName);
      arrayJoinKeys = resolved.keys;
      (resolved.unresolved ? console.warn : console.log)(`${resolved.unresolved ? '⚠' : 'ℹ'}  ${resolved.message}`);
    }
  }

  // The pre-flight prompt above already surfaced any join-key uniqueness issue to the
  // user, so suppress the library's per-file warning to avoid repeating it.
  await processDirectory(metadata, dataDir, verbose, `${project_path}/data`, { arrayJoinKeys, suppressJoinKeyWarning: true, normalizedBases, renamePlan: renamePlan ?? undefined });

  // check if it's a valid path and then prompt the options
  if (argv['metadata-options'] && validateJson(argv['metadata-options'])){
    if (verbose) console.log("\n\n-------------------------- Reading and writing metadata-option --------------------------n\n");
    await processOptions(metadata, argv['metadata-options'], verbose);
  }
  else if (canPrompt) await metadataOptionsPrompt(metadata, verbose); // passing in options file to overwite existing file
  // No options file and no terminal to prompt at: don't block — keep the generated defaults.
  else console.log('ℹ  No --metadata-options provided and no terminal to prompt — using generated defaults. Pass --metadata-options to customize.');

  if (canPrompt) await promptUnknownDescriptions(metadata);

  const metadataString = JSON.stringify(metadata.getMetadata(), null, 2); // Assuming getMetadata() is the function that retrieves your metadata
  if (argv.verbose) console.log("\n\n-------------------------- Final metadata string --------------------------\n\n", metadataString);
  await saveTextToPath(metadataString,`${project_path}/dataset_description.json`);

  if (typeof project_path === 'string') {
    const validation = await validatePsychDS(project_path, verbose);

    if (validation.missingRequiredFields.length > 0) {
      if (canPrompt) {
        console.log('\nSome required fields are missing. Please provide values:');
        for (const field of validation.missingRequiredFields) {
          const value = await input({ message: `Value for required field "${field}":` });
          if (value.trim()) {
            metadata.setMetadataField(field, value.trim());
          } else {
            console.warn(`  Skipped "${field}" — this field is still required. Validation may still fail.`);
          }
        }
        const updatedMetadata = JSON.stringify(metadata.getMetadata(), null, 2);
        await saveTextToPath(updatedMetadata, `${project_path}/dataset_description.json`);
        const revalidation = await validatePsychDS(project_path, verbose);
        if (revalidation.hasErrors) process.exit(1);
        if (revalidation.missingRecommendedFields.length > 0) {
          console.log(`\nConsider adding these recommended fields to your metadata: ${revalidation.missingRecommendedFields.join(', ')}`);
        }
      } else {
        process.exit(1);
      }
    } else if (validation.hasErrors) {
      process.exit(1);
    } else if (validation.missingRecommendedFields.length > 0) {
      console.log(`\nConsider adding these recommended fields to your metadata: ${validation.missingRecommendedFields.join(', ')}`);
    }
  }
};

main().catch((err) => {
  // Surface aborts (e.g. a rename-plan mismatch) cleanly with a non-zero exit instead of an
  // unhandled-rejection stack trace.
  console.error(`\n✘ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
