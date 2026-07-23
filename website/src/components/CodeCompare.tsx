import React, {useRef, useState} from 'react';
import styles from './CodeCompare.module.css';

/**
 * Lays out its two children (a "before" and "after" code block) as side-by-side panes with a
 * draggable divider in the middle, so readers can widen either side. Long lines wrap by default
 * (see the CSS) so full descriptions are visible without horizontal scrolling. Collapses to a
 * single stacked column on narrow screens, where the divider is hidden.
 */
export default function CodeCompare({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const panes = React.Children.toArray(children).filter(React.isValidElement);
  const containerRef = useRef<HTMLDivElement>(null);
  // Fraction of the width given to the left (raw) pane. The right pane (generated metadata) gets
  // the rest, and starts a little larger since its descriptions are long.
  const [left, setLeft] = useState(0.4);
  const [dragging, setDragging] = useState(false);

  const clamp = (v: number) => Math.min(0.8, Math.max(0.2, v));

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !containerRef.current) return;
    // If the button was released outside our handlers (e.g. after a pointercancel), stop dragging
    // so a plain hover over the divider no longer moves it.
    if (e.buttons === 0) {
      setDragging(false);
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    setLeft(clamp((e.clientX - rect.left) / rect.width));
  };
  // Handles pointerup AND pointercancel (touch/interrupted gestures fire cancel, not up).
  const endDrag = (e: React.PointerEvent) => {
    const el = e.target as HTMLElement;
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
    setDragging(false);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setLeft((v) => clamp(v - 0.02));
    else if (e.key === 'ArrowRight') setLeft((v) => clamp(v + 0.02));
  };

  const style = {'--left-col': `${(left * 100).toFixed(2)}%`} as React.CSSProperties;

  return (
    <div
      ref={containerRef}
      className={`${styles.row} code-compare ${dragging ? styles.dragging : ''}`}
      style={style}>
      <div className={styles.pane}>{panes[0]}</div>
      <div
        className={styles.gutter}
        role="separator"
        aria-orientation="vertical"
        aria-label="Drag to resize the comparison"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      />
      <div className={styles.pane}>{panes[1]}</div>
    </div>
  );
}
