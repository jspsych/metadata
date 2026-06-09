import { useState, useRef } from 'react';
import JsPsychMetadata, { AuthorFields } from '@jspsych/metadata';
import styles from './Authors.module.css';

interface AuthorsProps {
  jsPsychMetadata: JsPsychMetadata;
  onComplete: () => void;
}

const ORCID_PREFIX = 'https://orcid.org/';
const ORCID_RE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

function isValidOrcid(suffix: string): boolean {
  return ORCID_RE.test(suffix.trim());
}

type AuthorRow = {
  id: number;
  name: string;
  committedName: string | null; // name currently saved in jsPsychMetadata
  givenName: string;
  familyName: string;
  authorType: string;
  orcidSuffix: string; // just the part after https://orcid.org/
  optionalOpen: boolean;
};

function buildFields(row: AuthorRow, nameOverride?: string): AuthorFields {
  const name = nameOverride ?? row.name.trim();
  const fields: AuthorFields = { name };
  if (row.givenName.trim()) fields.givenName = row.givenName.trim();
  if (row.familyName.trim()) fields.familyName = row.familyName.trim();
  if (row.authorType.trim()) fields['@type'] = row.authorType.trim();
  if (row.orcidSuffix.trim()) fields.identifier = ORCID_PREFIX + row.orcidSuffix.trim();
  return fields;
}

function fromExisting(author: AuthorFields | string, id: number): AuthorRow {
  if (typeof author === 'string') {
    return { id, name: author, committedName: author, givenName: '', familyName: '', authorType: '', orcidSuffix: '', optionalOpen: false };
  }
  const orcidSuffix = author.identifier?.startsWith(ORCID_PREFIX)
    ? author.identifier.slice(ORCID_PREFIX.length)
    : (author.identifier ?? '');
  return {
    id,
    name: author.name,
    committedName: author.name,
    givenName: author.givenName ?? '',
    familyName: author.familyName ?? '',
    authorType: author['@type'] ?? '',
    orcidSuffix,
    optionalOpen: !!(author.givenName || author.familyName || author['@type'] || author.identifier),
  };
}

function emptyRow(id: number): AuthorRow {
  return { id, name: '', committedName: null, givenName: '', familyName: '', authorType: '', orcidSuffix: '', optionalOpen: false };
}

const Authors: React.FC<AuthorsProps> = ({ jsPsychMetadata, onComplete }) => {
  const nextIdRef = useRef(0);
  const nextId = () => nextIdRef.current++;

  const [rows, setRows] = useState<AuthorRow[]>(() => {
    const list = jsPsychMetadata.getAuthorList();
    return list.length > 0 ? list.map(a => fromExisting(a, nextIdRef.current++)) : [emptyRow(nextIdRef.current++)];
  });

  // Sync non-name fields to metadata immediately (name syncs on blur to avoid partial states)
  const updateField = (id: number, patch: Partial<AuthorRow>) => {
    setRows(prev => {
      const newRows = prev.map(r => r.id === id ? { ...r, ...patch } : r);
      const row = newRows.find(r => r.id === id)!;
      if (row.committedName) {
        jsPsychMetadata.setAuthor(buildFields(row));
      }
      return newRows;
    });
  };

  // Name changes only update local state — metadata sync happens on blur
  const updateName = (id: number, name: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, name } : r));
  };

  // UI-only changes (e.g. expand/collapse) that don't affect metadata
  const updateUiOnly = (id: number, patch: Partial<AuthorRow>) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const handleNameBlur = (id: number) => {
    setRows(prev => {
      const row = prev.find(r => r.id === id)!;
      const name = row.name.trim();

      if (!name) {
        // Clear the committed author from metadata if they had one
        if (row.committedName) {
          jsPsychMetadata.deleteAuthor(row.committedName);
          return prev.map(r => r.id === id ? { ...r, committedName: null } : r);
        }
        return prev;
      }

      if (row.committedName && row.committedName !== name) {
        jsPsychMetadata.deleteAuthor(row.committedName);
      }

      const updatedRow = { ...row, committedName: name };
      jsPsychMetadata.setAuthor(buildFields(updatedRow, name));
      return prev.map(r => r.id === id ? updatedRow : r);
    });
  };

  const removeRow = (id: number) => {
    setRows(prev => {
      const row = prev.find(r => r.id === id)!;
      if (row.committedName) jsPsychMetadata.deleteAuthor(row.committedName);
      if (prev.length > 1) return prev.filter(r => r.id !== id);
      return [emptyRow(nextId())];
    });
  };

  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkWarning, setBulkWarning] = useState<string | null>(null);

  const handleBulkImport = () => {
    const existingNames = new Set(rows.map(r => r.committedName?.toLowerCase()).filter(Boolean));
    const newRows: AuthorRow[] = [];
    const invalidOrcids: string[] = [];

    for (const rawLine of bulkText.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;

      const [rawName, rawOrcid = ''] = line.includes(',') ? line.split(',') : [line];
      const name = rawName.trim();
      if (!name) continue;
      if (existingNames.has(name.toLowerCase())) continue;

      // Normalise ORCID — strip full URL prefix if pasted
      const orcidRaw = rawOrcid.trim();
      const orcidNorm = orcidRaw.startsWith(ORCID_PREFIX)
        ? orcidRaw.slice(ORCID_PREFIX.length)
        : orcidRaw;

      // Validate ORCID — import name without it if invalid
      let orcidSuffix = '';
      if (orcidNorm) {
        if (isValidOrcid(orcidNorm)) {
          orcidSuffix = orcidNorm;
        } else {
          invalidOrcids.push(name);
        }
      }

      const id = nextId();
      const row: AuthorRow = { id, name, committedName: name, givenName: '', familyName: '', authorType: '', orcidSuffix, optionalOpen: !!orcidSuffix };
      jsPsychMetadata.setAuthor(buildFields(row));
      newRows.push(row);
      existingNames.add(name.toLowerCase());
    }

    if (newRows.length === 0) { setShowBulkImport(false); setBulkText(''); return; }

    // Replace the single empty placeholder row if it exists, otherwise append
    setRows(prev => {
      const hasOnlyEmpty = prev.length === 1 && !prev[0].committedName;
      return hasOnlyEmpty ? newRows : [...prev, ...newRows];
    });
    setShowBulkImport(false);
    setBulkText('');

    if (invalidOrcids.length > 0) {
      setBulkWarning(
        `ORCID not saved for: ${invalidOrcids.join(', ')}. ` +
        `ORCIDs must be in the format 0000-0001-2345-6789. Add them manually using the author cards above.`
      );
    } else {
      setBulkWarning(null);
    }
  };

  const savedCount = rows.filter(r => r.committedName).length;

  return (
    <div className={styles.page}>
      <h2 className={styles.heading}>
        Authors
        <span className={styles.count}>{savedCount}</span>
      </h2>
      <p className={styles.subtext}>
        Authors are optional. You can skip this step or add them later by re-opening existing metadata.
      </p>

      <div className={styles.cardList}>
        {rows.map((row, idx) => (
          <div key={row.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIndex}>Author {idx + 1}</span>
              {(rows.length > 1 || !!row.committedName) && (
                <button className={styles.removeBtn} onClick={() => removeRow(row.id)}>
                  Remove
                </button>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor={`author-name-${row.id}`}>
                Name <span className={styles.required}>*</span>
              </label>
              <input
                id={`author-name-${row.id}`}
                className={styles.input}
                type="text"
                value={row.name}
                placeholder="Full name or display name"
                onChange={e => updateName(row.id, e.target.value)}
                onBlur={() => handleNameBlur(row.id)}
              />
            </div>

            <div className={styles.optionalSection}>
              <button
                className={styles.optionalToggle}
                onClick={() => updateUiOnly(row.id, { optionalOpen: !row.optionalOpen })}
                aria-expanded={row.optionalOpen}
              >
                <span>
                  Optional fields{' '}
                  <span className={styles.optionalHint}>(ORCID, given name…)</span>
                </span>
                <span className={styles.chevron}>{row.optionalOpen ? '▲' : '▼'}</span>
              </button>

              {row.optionalOpen && (
                <div className={styles.optionalFields}>
                  <p className={styles.groupLabel}>Recommended if available</p>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor={`author-orcid-${row.id}`}>ORCID</label>
                    <div className={styles.orcidGroup}>
                      <span className={styles.orcidPrefix}>https://orcid.org/</span>
                      <input
                        id={`author-orcid-${row.id}`}
                        className={styles.orcidInput}
                        type="text"
                        value={row.orcidSuffix}
                        placeholder="0000-0001-2345-6789"
                        onChange={e => updateField(row.id, { orcidSuffix: e.target.value })}
                      />
                    </div>
                  </div>

                  <p className={styles.groupLabel} style={{ marginTop: '0.75rem' }}>Rarely needed</p>
                  <p className={styles.groupNote}>
                    For schema.org compatibility — most researchers can skip these.
                  </p>

                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor={`author-given-${row.id}`}>Given name</label>
                      <input
                        id={`author-given-${row.id}`}
                        className={styles.input}
                        type="text"
                        value={row.givenName}
                        placeholder="First name"
                        onChange={e => updateField(row.id, { givenName: e.target.value })}
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor={`author-family-${row.id}`}>Family name</label>
                      <input
                        id={`author-family-${row.id}`}
                        className={styles.input}
                        type="text"
                        value={row.familyName}
                        placeholder="Last name"
                        onChange={e => updateField(row.id, { familyName: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor={`author-type-${row.id}`}>@type</label>
                    <p className={styles.fieldHint}>
                      Usually "Person" or "Organization". Leave blank if unsure.
                    </p>
                    <input
                      id={`author-type-${row.id}`}
                      className={styles.input}
                      type="text"
                      list={`author-type-list-${row.id}`}
                      value={row.authorType}
                      placeholder="e.g. Person"
                      onChange={e => updateField(row.id, { authorType: e.target.value })}
                    />
                    <datalist id={`author-type-list-${row.id}`}>
                      <option value="Person" />
                      <option value="Organization" />
                    </datalist>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {bulkWarning && (
        <div className={styles.bulkWarning}>
          <span>⚠ {bulkWarning}</span>
          <button className={styles.warningDismiss} onClick={() => setBulkWarning(null)}>✕</button>
        </div>
      )}

      <button
        className={styles.addBtn}
        onClick={() => setRows(prev => [...prev, emptyRow(nextId())])}
      >
        + Add another author
      </button>

      {!showBulkImport ? (
        <button className={styles.bulkToggleBtn} onClick={() => setShowBulkImport(true)}>
          + Add multiple authors at once
        </button>
      ) : (
        <div className={styles.bulkPanel}>
          <p className={styles.bulkInstructions}>
            One author per line. To include an ORCID, separate it from the name with a comma:
          </p>
          <pre className={styles.bulkExample}>{'Jane Smith\nJohn Doe, 0000-0001-2345-6789\nAlice Lee, 0000-0002-3456-7890'}</pre>
          <textarea
            className={styles.bulkTextarea}
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            rows={6}
            placeholder="Paste author names here…"
            autoFocus
          />
          <div className={styles.bulkActions}>
            <button className={styles.importBtn} onClick={handleBulkImport}>
              Import
            </button>
            <button className={styles.cancelBtn} onClick={() => { setShowBulkImport(false); setBulkText(''); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <button className={styles.continueBtn} onClick={onComplete}>
        Continue →
      </button>
    </div>
  );
};

export default Authors;
