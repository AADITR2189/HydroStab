import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initStorage, requestPersistence } from './storage';
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
