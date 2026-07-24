import { useState } from 'react';
import JsPsychMetadata from '@jspsych/metadata';
import Landing from './pages/Landing';
import AppShell from './components/AppShell';
import { SAMPLE_DATASETS } from './samples';
import { useTheme } from './hooks/useTheme';

type AppPage = 'landing' | 'main';

/**
 * The `?sample=` slug forwarded by the docs site, but only if it names an allowlisted sample —
 * an unknown slug is ignored so a stray/hostile query param can't drive the app. When present we
 * skip the landing screen and go straight into the wizard, where DataUpload preloads the sample.
 */
function readValidSampleSlug(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const slug = new URLSearchParams(window.location.search).get('sample') ?? undefined;
  // hasOwnProperty, not a bare index lookup — otherwise a prototype-chain slug like `__proto__` or
  // `toString` resolves to an inherited (truthy) property and passes as an allowlisted sample.
  return slug && Object.prototype.hasOwnProperty.call(SAMPLE_DATASETS, slug) ? slug : undefined;
}

function App() {
  const [sampleSlug] = useState(readValidSampleSlug);
  const [page, setPage] = useState<AppPage>(sampleSlug ? 'main' : 'landing');
  const [jsPsychMetadata, setJsPsychMetadata] = useState(() => new JsPsychMetadata());
  const [existingMetadataFile, setExistingMetadataFile] = useState<File | undefined>();
  const { isDark, toggle: toggleTheme, embedded } = useTheme();

  const handleStart = (isNew: boolean, file?: File) => {
    if (!isNew && file) setExistingMetadataFile(file);
    setPage('main');
  };

  const handleStartOver = () => {
    setJsPsychMetadata(new JsPsychMetadata());
    setExistingMetadataFile(undefined);
    setPage('landing');
  };

  return (
    <>
      {/* When embedded on the docs site, the host navbar's toggle drives the
          theme, so we hide our own to avoid two controls. */}
      {!embedded && (
        <button className="themeToggle" onClick={toggleTheme}>
          {isDark ? '☀ Light' : '☾ Dark'}
        </button>
      )}
      {page === 'landing'
        ? <Landing onStart={handleStart} embedded={embedded} />
        : <AppShell
            jsPsychMetadata={jsPsychMetadata}
            existingMetadataFile={existingMetadataFile}
            sampleSlug={sampleSlug}
            onStartOver={handleStartOver}
          />
      }
    </>
  );
}

export default App;
