import React from 'react';
import Layout from '@theme/Layout';
import BrowserOnly from '@docusaurus/BrowserOnly';
import WizardEmbed from '@site/src/components/WizardEmbed';
import styles from './wizard.module.css';

export default function Wizard(): React.ReactElement {
  return (
    <Layout
      title="Wizard"
      description="Generate Psych-DS compliant metadata for your jsPsych experiment data, right in your browser.">
      {/* Render the embed client-only so it can read `?sample=` synchronously: the iframe is created
          once with the correct src (no post-mount src change that would reload the wizard app), and
          there's no SSR/hydration mismatch on the iframe. The frontend validates the slug against
          its own allowlist, so an unknown value is harmless. */}
      <BrowserOnly fallback={<div className={styles.wizardFrame} />}>
        {() => {
          const sample =
            new URLSearchParams(window.location.search).get('sample') ?? undefined;
          return <WizardEmbed className={styles.wizardFrame} sample={sample} />;
        }}
      </BrowserOnly>
    </Layout>
  );
}
