import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initStorage, requestPersistence } from './storage';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import './styles.css';
import { applyTheme, getTheme } from './ui/theme';

// colour theme before the first paint, so there is no flash of the wrong theme
applyTheme(getTheme());

// Load the local database (and move data of older versions) before the app starts.
const root = createRoot(document.getElementById('root')!);
root.render(<div className="boot">Opening the vessel database…</div>);
initStorage()
  .then(() => { void requestPersistence(); })
  .finally(() => root.render(<StrictMode><App /></StrictMode>));
