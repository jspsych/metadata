// jsonld ships no type declarations; we only use its default export as an opaque
// value to hand to the validator via window.jsonld.
declare module 'jsonld';

// The psychds-validator package only ships types for its Node entry point.
// Its browser bundle (validateWeb) is untyped, so we describe the slice we use.
declare module 'psychds-validator/web/psychds-validator.js' {
  /** A single validation issue as surfaced by the validator. */
  export interface PsychDSIssue {
    key: string;
    severity: 'error' | 'warning' | string;
    reason: string;
    files: Map<string, { evidence?: string }>;
  }

  export interface PsychDSValidationOutput {
    valid: boolean;
    /** Iterable of [key, issue] entries. */
    issues: Iterable<[string, PsychDSIssue]> & { get(key: string): PsychDSIssue | undefined };
    summary: unknown;
  }

  /** A node in the in-memory file tree handed to the validator. */
  export type WebFileNode =
    | { type: 'file'; file: Blob }
    | { type: 'directory'; contents: WebFileTree };
  export interface WebFileTree {
    [name: string]: WebFileNode;
  }

  export function validateWeb(
    fileTree: WebFileTree,
    options?: Record<string, unknown>,
  ): Promise<PsychDSValidationOutput>;
}
