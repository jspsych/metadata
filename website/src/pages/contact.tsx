import React from 'react';
import Layout from '@theme/Layout';
import styles from './contact.module.css';

export default function Contact(): React.ReactElement {
  return (
    <Layout title="Contact Us" description="How to get help with the jsPsych metadata tools.">
      <main className={styles.wrap}>
        <div className={styles.inner}>
          <h1>Contact Us</h1>
          <p>
            The jsPsych metadata tools are free and provided by the developers of
            jsPsych. We do not have a dedicated support team, but we do our best to
            respond to questions and issues.
          </p>
          <p>
            We ask that if you have a question or issue, you first check the{' '}
            <a href="https://github.com/jspsych/metadata/issues">
              GitHub repository issues
            </a>{' '}
            to see if your question has already been answered. If not, we encourage
            you to{' '}
            <a href="https://github.com/jspsych/metadata/issues/new">
              post a new issue
            </a>{' '}
            there.
          </p>
          <p>
            If you need to contact us directly, you can email Josh de Leeuw at{' '}
            <a href="mailto:jdeleeuw@vassar.edu">jdeleeuw@vassar.edu</a>.
          </p>
        </div>
      </main>
    </Layout>
  );
}
