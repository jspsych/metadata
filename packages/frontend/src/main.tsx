import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { sweepStaleStagingDirs } from './staging/stagedFileStore'
import './index.css'

// Reclaim OPFS staging subdirs from previous sessions that closed or crashed before clearing.
void sweepStaleStagingDirs()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
