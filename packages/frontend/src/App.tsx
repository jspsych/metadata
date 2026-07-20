import { useState } from 'react';
import JsPsychMetadata from '@jspsych/metadata';
import Landing from './pages/Landing';
import AppShell from './components/AppShell';
import { useTheme } from './hooks/useTheme';

type AppPage = 'landing' | 'main';

function App() {
  const [page, setPage] = useState<AppPage>('landing');
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
        ? <Landing onStart={handleStart} />
        : <AppShell
            jsPsychMetadata={jsPsychMetadata}
            existingMetadataFile={existingMetadataFile}
            onStartOver={handleStartOver}
          />
      }
    </>
  );
}

export default App;
