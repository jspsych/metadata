import {
  extractVaryingMiddles,
  findIdentifierColumn,
  reduceIdCandidates,
  sequentialBases,
  planRenames,
  unofficialKeywords,
  ID_COLUMNS,
} from '../src/rename';

describe('sequentialBases', () => {
  it('continues the numbering with zero-padding preserved', () => {
    expect(sequentialBases('subject-001', 3)).toEqual(['subject-001', 'subject-002', 'subject-003']);
  });

  it('works without padding', () => {
    expect(sequentialBases('subject-1', 3)).toEqual(['subject-1', 'subject-2', 'subject-3']);
  });

  it('grows past the padded width instead of wrapping', () => {
    expect(sequentialBases('subject-99', 3)).toEqual(['subject-99', 'subject-100', 'subject-101']);
  });

  it('keeps multi-pair prefixes intact', () => {
    expect(sequentialBases('task-stroop_subject-008', 2)).toEqual([
      'task-stroop_subject-008',
      'task-stroop_subject-009',
    ]);
  });

  it('returns null when the example does not end in digits', () => {
    expect(sequentialBases('subject-abc', 2)).toBeNull();
  });
});

describe('unofficialKeywords', () => {
  it('returns the unofficial keyword of a single-pair base', () => {
    expect(unofficialKeywords('data-pmlfboigs')).toEqual(['data']);
  });

  it('returns empty for fully official bases', () => {
    expect(unofficialKeywords('subject-01_session-2')).toEqual([]);
  });

  it('picks out only the unofficial keywords of a multi-pair base', () => {
    expect(unofficialKeywords('subject-01_measure-mouseTracking')).toEqual(['measure']);
  });
});

describe('extractVaryingMiddles', () => {
  it('extracts the varying part between a shared prefix and suffix', () => {
    const result = extractVaryingMiddles(['subject_data_1', 'subject_data_2', 'subject_data_10']);
    expect(result).toEqual({
      prefix: 'subject_data_',
      suffix: '',
      middles: new Map([
        ['subject_data_1', '1'],
        ['subject_data_2', '2'],
        ['subject_data_10', '10'],
      ]),
    });
  });

  it('handles a shared suffix', () => {
    const result = extractVaryingMiddles(['p01_results', 'p02_results']);
    expect(result).toEqual({
      prefix: 'p0',
      suffix: '_results',
      middles: new Map([
        ['p01_results', '1'],
        ['p02_results', '2'],
      ]),
    });
  });

  it('returns null for a single file', () => {
    expect(extractVaryingMiddles(['subject_data_1'])).toBeNull();
  });

  it('returns null when a middle would be empty', () => {
    expect(extractVaryingMiddles(['subject_data', 'subject_data_2'])).toBeNull();
  });

  it('returns null when middles collide', () => {
    expect(extractVaryingMiddles(['a_1_b', 'a_1_b'])).toBeNull();
  });

  it('does not let prefix and suffix overlap on the shortest stem', () => {
    // prefix "ab" + suffix "c" consume all of "abc", leaving an empty middle → null,
    // not a negative-length slice.
    expect(extractVaryingMiddles(['abc', 'abdc'])).toBeNull();
  });
});

describe('reduceIdCandidates', () => {
  it('collects the single unique value of each ID column', () => {
    const result = reduceIdCandidates([
      { subject_id: 'P01', rt: 500 },
      { subject_id: 'P01', rt: 600 },
    ]);
    expect(result.get('subject_id')).toEqual(new Set(['P01']));
  });

  it('only tracks ID columns, not arbitrary data columns', () => {
    const result = reduceIdCandidates([{ subject_id: 'P01', rt: 500, stimulus: 'a.png' }]);
    expect([...result.keys()].sort()).toEqual([...ID_COLUMNS].sort());
  });

  it('caps each set at 2 — a second distinct value already disqualifies the column', () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({ subject_id: `P${i}` }));
    const result = reduceIdCandidates(rows);
    expect(result.get('subject_id')!.size).toBe(2);
  });

  it('ignores empty, whitespace-only, null, and undefined values', () => {
    const result = reduceIdCandidates([
      { subject_id: 'P01' },
      { subject_id: '' },
      { subject_id: '   ' },
      { subject_id: null },
      { rt: 500 },
    ]);
    expect(result.get('subject_id')).toEqual(new Set(['P01']));
  });

  it('leaves an absent column as an empty set', () => {
    const result = reduceIdCandidates([{ rt: 500 }]);
    expect(result.get('subject_id')).toEqual(new Set());
  });
});

describe('findIdentifierColumn', () => {
  // Converts row-style test data to the per-file shape findIdentifierColumn takes,
  // using the same production reduction the scan in index.ts uses.
  const asUniques = (rowsByFile: Map<string, Array<Record<string, any>>>) => {
    const result = new Map<string, Map<string, Set<string>>>();
    for (const [fp, rows] of rowsByFile) {
      result.set(fp, reduceIdCandidates(rows));
    }
    return result;
  };

  const rows = (col: string, value: string) => [{ [col]: value, rt: 500 }, { [col]: value, rt: 600 }];

  it('finds a subject_id column with one unique value per file', () => {
    const result = findIdentifierColumn(
      asUniques(new Map([
        ['/a.csv', rows('subject_id', 'P01')],
        ['/b.csv', rows('subject_id', 'P02')],
      ]))
    );
    expect(result).toEqual({
      column: 'subject_id',
      values: new Map([
        ['/a.csv', 'P01'],
        ['/b.csv', 'P02'],
      ]),
    });
  });

  it('respects priority order (subject_id over participant)', () => {
    const result = findIdentifierColumn(
      asUniques(new Map([['/a.csv', [{ subject_id: 'P01', participant: 'X' }]]]))
    );
    expect(result?.column).toBe('subject_id');
  });

  it('rejects a column with multiple values in one file', () => {
    const result = findIdentifierColumn(
      asUniques(new Map([['/a.csv', [{ subject_id: 'P01' }, { subject_id: 'P02' }]]]))
    );
    expect(result).toBeNull();
  });

  it('rejects a column missing from one file', () => {
    const result = findIdentifierColumn(
      asUniques(new Map([
        ['/a.csv', rows('subject_id', 'P01')],
        ['/b.csv', [{ rt: 500 }]],
      ]))
    );
    expect(result).toBeNull();
  });

  it('ignores empty/null values when collecting uniques', () => {
    const result = findIdentifierColumn(
      asUniques(new Map([['/a.csv', [{ subject_id: 'P01' }, { subject_id: '' }, { subject_id: null }]]]))
    );
    expect(result?.values.get('/a.csv')).toBe('P01');
  });

  it('returns null for empty input', () => {
    expect(findIdentifierColumn(new Map())).toBeNull();
  });
});

describe('planRenames', () => {
  it('leaves unique main names untouched', () => {
    const plan = planRenames([
      { key: '/a', base: 'subject-1' },
      { key: '/b', base: 'subject-2' },
    ]);
    expect(plan.get('/a')!.mainName).toBe('subject-1_data.csv');
    expect(plan.get('/b')!.mainName).toBe('subject-2_data.csv');
    expect(plan.get('/a')!.mainAdjusted).toBe(false);
    expect(plan.get('/b')!.mainAdjusted).toBe(false);
  });

  it('appends a counter to later duplicate main names and flags them', () => {
    const plan = planRenames([
      { key: '/a', base: 'subject-1' },
      { key: '/b', base: 'subject-1' },
      { key: '/c', base: 'subject-1' },
    ]);
    expect(plan.get('/a')!.mainName).toBe('subject-1_data.csv');
    expect(plan.get('/b')!.mainName).toBe('subject-12_data.csv');
    expect(plan.get('/c')!.mainName).toBe('subject-13_data.csv');
    expect(plan.get('/a')!.mainAdjusted).toBe(false);
    expect(plan.get('/b')!.mainAdjusted).toBe(true);
    expect(plan.get('/c')!.mainAdjusted).toBe(true);
  });

  it('avoids colliding with an existing main name that matches the counter form', () => {
    const plan = planRenames([
      { key: '/a', base: 'subject-12' },
      { key: '/b', base: 'subject-1' },
      { key: '/c', base: 'subject-1' },
    ]);
    expect(plan.get('/b')!.mainName).toBe('subject-1_data.csv');
    // subject-12 is taken by /a, so /c skips to subject-13.
    expect(plan.get('/c')!.mainName).toBe('subject-13_data.csv');
  });

  it('disambiguates a renamed main name against an already-compliant file', () => {
    // /a is already compliant (subject-1); the renamed /b proposes the same base.
    const plan = planRenames([
      { key: '/a', base: 'subject-1' },
      { key: '/b', base: 'subject-1' },
    ]);
    expect(plan.get('/a')!.mainName).toBe('subject-1_data.csv');
    expect(plan.get('/b')!.mainName).toBe('subject-12_data.csv');
    expect(plan.get('/b')!.mainAdjusted).toBe(true);
  });

  it('reserves names for array and object sidecars', () => {
    const plan = planRenames([
      { key: '/a', base: 'subject-1', arrayColumns: ['responses'], objectColumns: ['view'] },
    ]);
    expect(plan.get('/a')!.sidecars).toEqual([
      { column: 'responses', kind: 'array', filename: 'subject-1_measure-responses_data.csv', adjusted: false },
      { column: 'view', kind: 'object', filename: 'subject-1_measure-view_data.csv', adjusted: false },
    ]);
  });

  it('bumps a main name that collides with an earlier file\'s sidecar (the cross-file gap)', () => {
    // /a emits sidecar "subject-1_measure-responses_data.csv"; /b's base is exactly that
    // sidecar's stem, so its main name must be disambiguated — the case the mains-only
    // preview used to miss, silently writing a name the user never approved.
    const plan = planRenames([
      { key: '/a', base: 'subject-1', arrayColumns: ['responses'] },
      { key: '/b', base: 'subject-1_measure-responses' },
    ]);
    expect(plan.get('/a')!.sidecars[0].filename).toBe('subject-1_measure-responses_data.csv');
    expect(plan.get('/b')!.mainName).toBe('subject-1_measure-responses2_data.csv');
    expect(plan.get('/b')!.mainAdjusted).toBe(true);
  });

  it('bumps a sidecar that collides with another file\'s sidecar of the same base', () => {
    // Two files resolve to base subject-1 (mains disambiguate to subject-1 / subject-12),
    // but both derive their "x" sidecar from the shared base, so the second is bumped —
    // matching how the writer derives sidecar names from the base, not the bumped main.
    const plan = planRenames([
      { key: '/a', base: 'subject-1', arrayColumns: ['x'] },
      { key: '/b', base: 'subject-1', arrayColumns: ['x'] },
    ]);
    expect(plan.get('/a')!.sidecars[0].filename).toBe('subject-1_measure-x_data.csv');
    expect(plan.get('/b')!.mainName).toBe('subject-12_data.csv');
    expect(plan.get('/b')!.sidecars[0].filename).toBe('subject-1_measure-x2_data.csv');
    expect(plan.get('/b')!.sidecars[0].adjusted).toBe(true);
  });
});
