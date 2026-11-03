import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './theme/fonts';
import './theme/tokens.css';
import './theme/global.css';
import { App } from './app/App';
import { Providers } from './app/Providers';
import { openDatabase } from './data/db';
import { startDatabase } from './data/startup';
import { initTheme } from './theme/theme';

// Set data-theme before the first render so the first frame already has the right colours.
initTheme(window);

// Screens read the database live, so they update as soon as the seed is written.
const db = openDatabase();
startDatabase(db, navigator.storage).catch((error: unknown) => {
  console.error('Could not start the local database', error);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <Providers db={db}>
      <App />
    </Providers>
  </StrictMode>,
);
