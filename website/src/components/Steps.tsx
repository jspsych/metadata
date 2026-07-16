import React from 'react';
import styles from './Steps.module.css';

/**
 * Numbered step-card layout for walkthroughs, styled after
 * pipe.jspsych.org/getting-started: a teal number badge + title, with the step
 * body indented beneath. Put extra detail in a default-collapsed <details> so
 * the page stays scannable.
 *
 *   <Steps>
 *     <Step n={1} title="Do the thing">
 *       markdown content…
 *     </Step>
 *   </Steps>
 */
export function Steps({children}: {children: React.ReactNode}): React.ReactElement {
  return <div className={styles.steps}>{children}</div>;
}

export function Step({
  n,
  title,
  children,
}: {
  n: number | string;
  title: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className={styles.step}>
      <div className={styles.head}>
        <span className={styles.num} aria-hidden="true">
          {n}
        </span>
        <h2 className={styles.title}>{title}</h2>
      </div>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
