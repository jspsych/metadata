import {
  extractVaryingMiddles,
  findIdentifierColumn,
  reduceIdCandidates,
  sequentialBases,
  resolveCollisions,
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

describe('resolveCollisions', () => {
  it('leaves unique bases untouched', () => {
    const { bases, adjusted } = resolveCollisions(
      new Map([
        ['/a', 'subject-1'],
        ['/b', 'subject-2'],
      ])
    );
    expect(bases.get('/a')).toBe('subject-1');
    expect(bases.get('/b')).toBe('subject-2');
    expect(adjusted.size).toBe(0);
  });

  it('appends a counter to later duplicates and flags them', () => {
    const { bases, adjusted } = resolveCollisions(
      new Map([
        ['/a', 'subject-1'],
        ['/b', 'subject-1'],
        ['/c', 'subject-1'],
      ])
    );
    expect(bases.get('/a')).toBe('subject-1');
    expect(bases.get('/b')).toBe('subject-12');
    expect(bases.get('/c')).toBe('subject-13');
    expect(adjusted).toEqual(new Set(['/b', '/c']));
  });

  it('avoids colliding with an existing base that matches the counter form', () => {
    const { bases } = resolveCollisions(
      new Map([
        ['/a', 'subject-12'],
        ['/b', 'subject-1'],
        ['/c', 'subject-1'],
      ])
    );
    expect(bases.get('/b')).toBe('subject-1');
    expect(bases.get('/c')).toBe('subject-13');
  });

  it('avoids colliding with already-compliant kept bases passed as keptBases', () => {
    // subject-1 is already taken by a kept (non-renamed) file; the proposal for /b
    // should be disambiguated even though /b is the first in proposals.
    const kept = ['subject-1'];
    const { bases, adjusted } = resolveCollisions(
      new Map([['/b', 'subject-1']]),
      kept
    );
    expect(bases.get('/b')).toBe('subject-12');
    expect(adjusted.has('/b')).toBe(true);
  });
});
