import { useState } from 'react';
import JsPsychMetadata, { VariableFields } from '@jspsych/metadata';
import styles from './Variables.module.css';

interface VariablesProps {
  jsPsychMetadata: JsPsychMetadata;
  onComplete: () => void;
}

type VarRow = VariableFields & { needsAttention: boolean };

const VALUE_TYPES = ['string', 'numeric', 'boolean', 'array', 'unknown'] as const;

function descMap(desc: VariableFields['description']): Record<string, string> {
  if (!desc) return {};
  if (typeof desc === 'string') return { default: desc };
  return desc as Record<string, string>;
}

function editableDefault(desc: VariableFields['description']): string {
  const map = descMap(desc);
  const d = map['default'];
  // Use the default value if it's a real user-written string (not absent or the sentinel "unknown").
  // An explicitly cleared empty string (d === '') also counts — prevents snapping back to the hint.
  if (d !== undefined && d !== 'unknown') return d;
  // Fall back to the first plugin hint as the current effective description
  const h = hints(desc);
  return h.length > 0 ? h[0].value : '';
}

function hints(desc: VariableFields['description']): { key: string; value: string }[] {
  if (!desc || typeof desc === 'string') return [];
  return Object.entries(desc as Record<string, string>)
    .filter(([k, v]) => k !== 'default' && v !== 'unknown')
    .map(([k, v]) => ({ key: k, value: v }));
}

function isUnknown(v: VariableFields): boolean {
  if (!v.value || v.value === 'unknown') return true;
  const map = descMap(v.description);
  if (Object.keys(map).length === 0) return true;
  return Object.values(map).every(val => !val || val === 'unknown');
}

function loadVars(meta: JsPsychMetadata): VarRow[] {
  return meta.getVariableNames().map(name => {
    const v = meta.getVariable(name) as VariableFields;
    return { ...v, needsAttention: isUnknown(v) };
  });
}

const Variables: React.FC<VariablesProps> = ({ jsPsychMetadata, onComplete }) => {
  const [vars, setVars] = useState<VarRow[]>(() => loadVars(jsPsychMetadata));
  const [expanded, setExpanded] = useState<string | null>(null);

  // Frozen at mount — variables never move between sections while editing
  const [initialUnknowns] = useState<Set<string>>(
    () => new Set(vars.filter(v => v.needsAttention).map(v => v.name))
  );

  const needDescSection = vars
    .filter(v => initialUnknowns.has(v.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  const otherSection = vars
    .filter(v => !initialUnknowns.has(v.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  const remainingCount = needDescSection.filter(v => v.needsAttention).length;

  const handleDescChange = (name: string, text: string) => {
    jsPsychMetadata.updateVariable(name, 'description', { default: text });
    setVars(prev => prev.map(v => {
      if (v.name !== name) return v;
      const newDesc = { ...(descMap(v.description)), default: text };
      return { ...v, description: newDesc, needsAttention: isUnknown({ ...v, description: newDesc }) };
    }));
  };

  const handleTypeChange = (name: string, type: string) => {
    jsPsychMetadata.updateVariable(name, 'value', type);
    setVars(prev => prev.map(v => {
      if (v.name !== name) return v;
      return { ...v, value: type, needsAttention: isUnknown({ ...v, value: type }) };
    }));
  };

  const renderVar = (v: VarRow) => {
    const isOpen = expanded === v.name;
    const descValue = editableDefault(v.description);
    const d = descMap(v.description)['default'];
    const hasPluginDesc = (d === undefined || d === 'unknown') && hints(v.description).length > 0;
    const inUnknownSection = initialUnknowns.has(v.name);

    const hasDetails = true; // type selector always available; levels/range shown when present

    return (
      <li
        key={v.name}
        className={`${styles.row} ${inUnknownSection ? styles.rowUnknown : styles.rowKnown}`}
      >
        <button
          className={styles.rowHeader}
          onClick={() => setExpanded(prev => prev === v.name ? null : v.name)}
          aria-expanded={isOpen}
        >
          <span className={styles.rowName}>{v.name}</span>
          <span className={styles.rowRight}>
            <span className={`${styles.typeBadge} ${!v.value || v.value === 'unknown' ? styles.typeBadgeUnknown : ''}`}>
              {v.value || 'unknown'}
            </span>
            {v.needsAttention
              ? <span className={styles.warnBadge}>⚠ no description</span>
              : inUnknownSection && <span className={styles.doneBadge}>✓ filled in</span>
            }
            {hasDetails && (
              <span className={styles.chevron}>{isOpen ? '▲' : '▼'}</span>
            )}
          </span>
        </button>

        <div className={styles.inlineDesc}>
          <textarea
            className={styles.textarea}
            value={descValue}
            placeholder="Describe what this variable measures…"
            rows={2}
            onChange={e => handleDescChange(v.name, e.target.value)}
          />
          {hasPluginDesc && (
            <p className={styles.descCaption}>
              From plugin documentation — edit to save a custom description
            </p>
          )}
        </div>

        {isOpen && hasDetails && (
          <div className={styles.rowBody}>
            <div className={styles.field}>
              <label className={styles.label}>Type</label>
              <select
                className={styles.select}
                value={v.value || 'unknown'}
                onChange={e => handleTypeChange(v.name, e.target.value)}
              >
                {VALUE_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {v.levels && v.levels.length > 0 && (
              <div className={styles.field}>
                <label className={styles.label}>Detected levels</label>
                <div className={styles.levels}>
                  {(v.levels as string[]).map((l, i) => (
                    <span key={i} className={styles.level}>{l}</span>
                  ))}
                </div>
              </div>
            )}

            {(v.minValue !== undefined || v.maxValue !== undefined) && (
              <div className={styles.field}>
                <label className={styles.label}>Range</label>
                <span className={styles.rangeText}>
                  {v.minValue ?? '—'} – {v.maxValue ?? '—'}
                </span>
              </div>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className={styles.page}>
      <h2 className={styles.heading}>
        Variables
        <span className={styles.count}>{vars.length}</span>
      </h2>

      {needDescSection.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.sectionTitle}>Missing descriptions</span>
              <span className={styles.sectionOptional}> — optional</span>
            </div>
            <span className={styles.sectionProgress}>
              {needDescSection.length - remainingCount} / {needDescSection.length} filled in
            </span>
          </div>
          <ul className={styles.list}>
            {needDescSection.map(renderVar)}
          </ul>
        </section>
      )}

      {otherSection.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Other variables</span>
            <span className={styles.sectionCount}>{otherSection.length}</span>
          </div>
          <ul className={styles.list}>
            {otherSection.map(renderVar)}
          </ul>
        </section>
      )}

      <button className={styles.continueBtn} onClick={onComplete}>
        Continue →
      </button>
    </div>
  );
};

export default Variables;
