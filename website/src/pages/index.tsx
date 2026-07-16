import React, {useEffect, useRef} from 'react';
import Layout from '@theme/Layout';
import {useColorMode} from '@docusaurus/theme-common';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './index.module.css';

/**
 * Embeds the metadata wizard (built from packages/frontend into
 * static/wizard-app/) and keeps its theme in sync with the site's color-mode
 * toggle via postMessage, so the single navbar toggle controls both. The
 * wizard hides its own theme button when it detects it's framed.
 */
function WizardFrame(): React.ReactElement {
  const {colorMode} = useColorMode(); // resolved 'light' | 'dark'
  const base = useBaseUrl('/wizard-app/');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Capture the initial theme once for the src, so later toggles don't reload
  // the iframe (which would reset wizard progress) — updates go via postMessage.
  const initialTheme = useRef(colorMode).current;

  const pushTheme = () => {
    iframeRef.current?.contentWindow?.postMessage(
      {type: 'jspsych-theme', theme: colorMode},
      '*',
    );
  };

  // Push the theme whenever the site color mode changes.
  useEffect(pushTheme, [colorMode]);

  // Answer the wizard's ready handshake with the current theme (covers the race
  // where the iframe app mounts after we'd otherwise have posted).
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'jspsych-wizard-ready') pushTheme();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  });

  return (
    <iframe
      ref={iframeRef}
      className={styles.wizardFrame}
      src={`${base}?theme=${initialTheme}`}
      title="jsPsych Metadata Wizard"
      onLoad={pushTheme}
    />
  );
}

export default function Home(): React.ReactElement {
  return (
    <Layout
      title="Metadata Wizard"
      description="Generate Psych-DS compliant metadata for your jsPsych experiment data, right in your browser."
      noFooter>
      <WizardFrame />
    </Layout>
  );
}
