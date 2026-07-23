import React from 'react';
import clsx from 'clsx';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import {JspsychBrain} from '@jspsych/docusaurus-theme/components';
import styles from './index.module.css';

function TwoWays(): React.ReactElement {
  return (
    <div className={styles.heroPaths}>
      <div className={styles.pathList}>
        <div className={styles.pathCard}>
          <div className={styles.pathCardHead}>
            <svg className={styles.pathCardIcon} width="20" height="20" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
              strokeLinejoin="round" aria-hidden="true">
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51z" />
              <path d="M13 13l6 6" />
            </svg>
            <h3 className={styles.pathCardTitle}>Web wizard</h3>
          </div>
          <p className={styles.pathCardDesc}>
            Point-and-click in your browser. Nothing leaves your computer.
          </p>
          <div className={styles.pathCardActions}>
            <Link className="button button--primary" to="/wizard">
              Open the wizard
            </Link>
            <Link className={styles.pathLink} to="/docs/guides/using-the-wizard">
              Learn more →
            </Link>
          </div>
        </div>
        <div className={styles.pathCard}>
          <div className={styles.pathCardHead}>
            <svg className={styles.pathCardIcon} width="20" height="20" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
              strokeLinejoin="round" aria-hidden="true">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
            <h3 className={styles.pathCardTitle}>Command-line tool</h3>
          </div>
          <p className={styles.pathCardDesc}>
            Generate metadata locally or automate it across many experiment
            files.
          </p>
          <div className={styles.pathCardActions}>
            <Link className={styles.pathLink} to="/docs/guides/using-the-cli">
              Learn more →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero(): React.ReactElement {
  return (
    <header className={styles.hero}>
      <div className={styles.heroRow}>
        <div className={styles.heroCopy}>
          {/* Reuse the theme's animated dot-brain: the `navbar__brand` class is
              the hover hook for its synapse-fire cascade (see the theme's
              JspsychBrain CSS module). */}
          <span className={clsx('navbar__brand', styles.heroLogo)}>
            <JspsychBrain className={styles.heroBrain} />
          </span>
          <div className={styles.heroText}>
            <h1 className={styles.heroTitle}>
              Turn your jsPsych experiment into a{' '}
              <span className={styles.heroTitleAccent}>shareable dataset</span>.
            </h1>
            <p className={styles.heroLede}>
              It creates a file that describes your experiment and its variables,
              so your data is easier to share, archive, and reuse.
            </p>
            <p className={styles.heroStandard}>
              The output follows the{' '}
              <Link to="/docs/introduction">Psych-DS standard</Link>, so your
              dataset is understandable to other researchers and software right
              out of the box.
            </p>
          </div>
        </div>
        <TwoWays />
      </div>
    </header>
  );
}

function BookIcon(): React.ReactElement {
  return (
    <svg className={styles.featureIcon} width="28" height="28" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function DatabaseIcon(): React.ReactElement {
  return (
    <svg className={styles.featureIcon} width="28" height="28" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

function ShieldIcon(): React.ReactElement {
  return (
    <svg className={styles.featureIcon} width="28" height="28" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function Features(): React.ReactElement {
  return (
    <section className={styles.features}>
      <p className={styles.featuresEyebrow}>Features</p>

      <div className={styles.featureGrid}>
        <div>
          <BookIcon />
          <h3 className={styles.featureTitle}>Descriptions from the plugins</h3>
          <p className={styles.featureBody}>
            Columns are described automatically from the jsPsych plugin that
            recorded them, and you fill in the rest by hand.
          </p>
        </div>
        <div>
          <DatabaseIcon />
          <h3 className={styles.featureTitle}>Any jsPsych export</h3>
          <p className={styles.featureBody}>
            CSV, JSON, and JSON-Lines all work, and your original files are
            always kept.
          </p>
        </div>
        <div>
          <ShieldIcon />
          <h3 className={styles.featureTitle}>Validation built in</h3>
          <p className={styles.featureBody}>
            The wizard checks your dataset against Psych-DS in your browser
            before you share it.
          </p>
        </div>
      </div>
    </section>
  );
}

function SeeItInAction(): React.ReactElement {
  return (
    <section className={styles.showcase}>
      <div className={styles.showcaseCard}>
        <div className={styles.showcaseText}>
          <p className={styles.featuresEyebrow}>See it in action</p>
          <h3 className={styles.showcaseTitle}>
            A Serial Reaction Time experiment, before and after
          </h3>
          <p className={styles.showcaseBody}>
            See how cryptic jsPsych columns like <code>grid</code> and{' '}
            <code>target</code> turn into readable descriptions — then run the
            tool on the same sample yourself, no upload needed.
          </p>
        </div>
        <Link
          className="button button--primary"
          to="/docs/guides/serial-reaction-time">
          See the example →
        </Link>
      </div>
    </section>
  );
}

export default function Home(): React.ReactElement {
  return (
    <Layout description="Generate Psych-DS compliant metadata for your jsPsych experiment data, in the browser or from the command line.">
      <main>
        <Hero />
        <Features />
        <SeeItInAction />
      </main>
    </Layout>
  );
}
