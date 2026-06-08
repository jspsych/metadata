import { useState } from 'react';
import JsPsychMetadata from '@jspsych/metadata';
import Landing from './pages/Landing';
import AppShell from './components/AppShell';

type AppPage = 'landing' | 'main';

function App() {
  const [page, setPage] = useState<AppPage>('landing');
  const [jsPsychMetadata, setJsPsychMetadata] = useState(() => new JsPsychMetadata());
  const [existingMetadataFile, setExistingMetadataFile] = useState<File | undefined>();

  const handleStart = (isNew: boolean, file?: File) => {
    if (!isNew && file) setExistingMetadataFile(file);
    setPage('main');
  };

  const handleStartOver = () => {
    setJsPsychMetadata(new JsPsychMetadata());
    setExistingMetadataFile(undefined);
    setPage('landing');
  };

  if (page === 'landing') return <Landing onStart={handleStart} />;

  return (
    <AppShell
      jsPsychMetadata={jsPsychMetadata}
      existingMetadataFile={existingMetadataFile}
      onStartOver={handleStartOver}
    />
  );
}

export default App;
