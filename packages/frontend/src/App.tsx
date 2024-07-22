import Metadata from "./pages/Metadata";
import Options from './pages/Options.tsx'
import JsPsychMetadata from 'metadata';
import './App.css'

var jsPsychMetadata = new JsPsychMetadata();

function App() {
  console.log(jsPsychMetadata.getMetadata());
  return (
    <>
      <Metadata />
      <Options />
    </>
  )
}

export default App;