// Sample datasets the docs site can deep-link into the wizard via `?sample=<slug>`. Kept in its own
// module (not in a component file) so the allowlist can be shared by App, AppShell, and DataUpload
// without tripping react-refresh's only-export-components rule.

/** A named sample dataset the docs site can deep-link into the wizard via `?sample=<slug>`. */
export type SampleDataset = {
  /** Human-readable label; used as the source name in the picker and the project's `name` field. */
  label: string;
  /**
   * Default project `description`. Seeded up front (like `label`) so a visitor who follows the
   * sample straight to Review has the Psych-DS-required `description` field without stopping at
   * Project Info; they can still edit it there.
   */
  description: string;
  /**
   * Files to fetch and preload, each with the filename to give the created `File`. URLs are
   * resolved against the running document (see DataUpload's preload effect): the wizard is served
   * under `<baseUrl>/wizard-app/`, so `../examples/…` reaches the docs site's `static/examples/`
   * regardless of the site's `baseUrl`.
   */
  files: { url: string; name: string }[];
};

/**
 * Allowlist of samples the docs "try this sample" links may preload. Keyed by the `?sample=` slug;
 * an unknown slug is ignored upstream (see App.tsx) so a stray/hostile query param can't drive the
 * app. Keep in sync with the guides under `website/docs/` that link here.
 */
export const SAMPLE_DATASETS: Record<string, SampleDataset> = {
  'serial-reaction-time': {
    label: 'Serial Reaction Time (sample)',
    description:
      'Sample data from a jsPsych Serial Reaction Time task, used to demonstrate the jsPsych ' +
      'metadata tools. Not real experimental data.',
    files: [
      {
        url: '../examples/serial-reaction-time/sample-data.json',
        name: 'serial-reaction-time.json',
      },
    ],
  },
};

/**
 * The project-level metadata a preloaded sample seeds: how a {@link SampleDataset} maps onto the
 * Psych-DS `name`/`description` fields. Single source of this mapping so AppShell can apply it to
 * both the jsPsychMetadata instance and the Project Info form session without them drifting apart.
 */
export const sampleProjectFields = (sample: SampleDataset): { name: string; description: string } =>
  ({ name: sample.label, description: sample.description });
