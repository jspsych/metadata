/** Builds a validator output object in the shape validatePsychDS consumes. */
export function validatorOutput(
  issues: {
    key: string;
    reason: string;
    severity: "error" | "warning";
    evidence?: (string | undefined)[];
  }[],
) {
  return {
    issues: new Map(
      issues.map((issue) => [
        issue.key,
        {
          key: issue.key,
          reason: issue.reason,
          severity: issue.severity,
          files: new Map(
            (issue.evidence ?? []).map((evidence, i) => [`file${i}`, { evidence }]),
          ),
        },
      ]),
    ),
  };
}
