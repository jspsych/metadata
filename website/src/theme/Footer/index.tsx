import React from 'react';
import Link from '@docusaurus/Link';
import {JspsychBrain} from '@jspsych/docusaurus-theme/components';
import styles from './styles.module.css';

/**
 * Custom single-row footer modeled on pipe.jspsych.org: a "Created by the
 * developers of jsPsych" brand lockup on the left, a few links, and a Donate
 * button on the right. Replaces the default multi-column Docusaurus footer.
 */
export default function Footer(): React.ReactElement {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <Link className={styles.brand} href="https://www.jspsych.org">
          Created by the developers of jsPsych
          <JspsychBrain className={styles.brainMark} />
        </Link>

        <nav className={styles.links}>
          <Link className={styles.link} href="https://github.com/jspsych/metadata/issues">
            Report an Issue
          </Link>
          <Link className={styles.link} href="https://github.com/jspsych/metadata">
            GitHub
          </Link>
          <Link className={styles.link} href="https://github.com/jspsych/jspsych/discussions">
            Discussions
          </Link>
          <Link className={styles.link} to="/contact">
            Contact Us
          </Link>
        </nav>

        <Link className={styles.donate} href="https://opencollective.com/jspsych">
          Donate on Open Collective
        </Link>
      </div>
    </footer>
  );
}
