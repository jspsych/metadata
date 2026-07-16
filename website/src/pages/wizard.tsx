import React from 'react';
import Layout from '@theme/Layout';
import WizardEmbed from '@site/src/components/WizardEmbed';
import styles from './wizard.module.css';

export default function Wizard(): React.ReactElement {
  return (
    <Layout
      title="Wizard"
      description="Generate Psych-DS compliant metadata for your jsPsych experiment data, right in your browser."
      noFooter>
      <WizardEmbed className={styles.wizardFrame} />
    </Layout>
  );
}
