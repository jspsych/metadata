import { useState } from 'react';
import styles from './JsonViewer.module.css';

function escapeStr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

interface NodeProps {
  value: unknown;
  propKey?: string;
  isLast: boolean;
}

const JsonNode: React.FC<NodeProps> = ({ value, propKey, isLast }) => {
  const [open, setOpen] = useState(true);
  const suffix = isLast ? null : <span className={styles.punct}>,</span>;

  const keyEl = propKey !== undefined ? (
    <><span className={styles.key}>"{propKey}"</span><span className={styles.colon}>: </span></>
  ) : null;

  if (value === null) {
    return <div className={styles.line}>{keyEl}<span className={styles.null}>null</span>{suffix}</div>;
  }
  if (typeof value === 'boolean') {
    return <div className={styles.line}>{keyEl}<span className={styles.bool}>{String(value)}</span>{suffix}</div>;
  }
  if (typeof value === 'number') {
    return <div className={styles.line}>{keyEl}<span className={styles.num}>{value}</span>{suffix}</div>;
  }
  if (typeof value === 'string') {
    return <div className={styles.line}>{keyEl}<span className={styles.str}>"{escapeStr(value)}"</span>{suffix}</div>;
  }

  const isArr = Array.isArray(value);
  const entries: [string, unknown][] = isArr
    ? (value as unknown[]).map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, unknown>);
  const openBrace = isArr ? '[' : '{';
  const closeBrace = isArr ? ']' : '}';

  if (entries.length === 0) {
    return (
      <div className={styles.line}>
        {keyEl}<span className={styles.brace}>{openBrace}{closeBrace}</span>{suffix}
      </div>
    );
  }

  return (
    <div className={styles.node}>
      <div className={styles.line}>
        {keyEl}
        <button
          className={styles.toggle}
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          {open ? '▾' : '▸'}
        </button>
        <span className={styles.brace}>{openBrace}</span>
        {/* Collapsed summary — hidden (not unmounted) when open, so child state survives */}
        <span className={open ? styles.hidden : undefined}>
          <span className={styles.summary}>
            {isArr
              ? `${entries.length} item${entries.length !== 1 ? 's' : ''}`
              : `${entries.length} field${entries.length !== 1 ? 's' : ''}`}
          </span>
          <span className={styles.brace}>{closeBrace}</span>
          {suffix}
        </span>
      </div>

      {/* Children + closing bracket — hidden (not unmounted) when collapsed */}
      <div className={open ? undefined : styles.hidden}>
        <div className={styles.children}>
          {entries.map(([k, v], i) => (
            <JsonNode
              key={k}
              value={v}
              propKey={isArr ? undefined : k}
              isLast={i === entries.length - 1}
            />
          ))}
        </div>
        <div className={styles.line}>
          <span className={styles.brace}>{closeBrace}</span>{suffix}
        </div>
      </div>
    </div>
  );
};

interface JsonViewerProps {
  data: unknown;
}

const JsonViewer: React.FC<JsonViewerProps> = ({ data }) => (
  <div className={styles.viewer}>
    <JsonNode value={data} isLast={true} />
  </div>
);

export default JsonViewer;
