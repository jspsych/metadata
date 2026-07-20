import { useEffect, useState } from 'react';

/** True when the app runs inside an iframe (e.g. embedded on the docs site). */
const isEmbedded = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true; // cross-origin access throws → we're framed
  }
};

function getInitialIsDark(): boolean {
  // When embedded, follow the `?theme=` the host passes so we match the site on
  // first paint (before the postMessage handshake below kicks in).
  if (isEmbedded()) {
    const param = new URLSearchParams(window.location.search).get('theme');
    if (param === 'dark') return true;
    if (param === 'light') return false;
  }
  const stored = localStorage.getItem('theme');
  if (stored === 'dark') return true;
  if (stored === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function useTheme() {
  const embedded = isEmbedded();
  const [isDark, setIsDark] = useState(getInitialIsDark);

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  }, [isDark]);

  // When embedded, let the host page's theme toggle drive our theme. We don't
  // persist these to localStorage — the host is the source of truth here.
  useEffect(() => {
    if (!embedded) return;
    const onMessage = (e: MessageEvent) => {
      const data = e.data;
      if (data?.type === 'jspsych-theme' && (data.theme === 'dark' || data.theme === 'light')) {
        setIsDark(data.theme === 'dark');
      }
    };
    window.addEventListener('message', onMessage);
    // Ask the host for the current theme now that we're listening.
    window.parent?.postMessage({ type: 'jspsych-wizard-ready' }, '*');
    return () => window.removeEventListener('message', onMessage);
  }, [embedded]);

  const toggle = () => {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  };

  return { isDark, toggle, embedded } as const;
}
