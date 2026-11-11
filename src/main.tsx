import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './theme/fonts';
import './theme/tokens.css';
import './theme/global.css';
import { App } from './app/App';
import { DatabaseGate } from './app/DatabaseGate';
import { Providers } from './app/Providers';
import { preloadScreens } from './app/routes';
import { openDatabase } from './data/db';
import { getLocalStorage } from './data/deviceStorage';
import { startDatabase } from './data/startup';
import { connectBrowserTriggers } from './data/sync/browserTriggers';
import { createSyncEngine } from './data/sync/engine';
import { createHttpTransport } from './data/sync/httpTransport';
import { localKeyStore } from './data/sync/syncKey';
import { initTheme } from './theme/theme';

// Set data-theme before the first render so the first frame already has the right colours.
initTheme(window);

// Screens read the database live, so they update as soon as the seed is written.
const db = openDatabase();

// Sync starts once the local database is ready; without a key it does nothing.
const sync = createSyncEngine({
  db,
  keyStore: localKeyStore(getLocalStorage(window)),
  createTransport: (key) => createHttpTransport({ key }),
  isOnline: () => navigator.onLine,
});
connectBrowserTriggers(sync, window);

// Resolves to false when the database could not be started: <DatabaseGate> then shows a message
// and sync stays stopped (there is nothing to sync from a database that does not open).
const started = startDatabase(db, navigator.storage).then(
  () => {
    sync.start();
    return true;
  },
  (error: unknown) => {
    console.error('Could not start the local database', error);
    return false;
  },
);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <Providers db={db} sync={sync}>
      <DatabaseGate started={started}>
        <App />
      </DatabaseGate>
    </Providers>
  </StrictMode>,
);

// Once the app is up, download the other sections in the background (see preloadScreens).
window.addEventListener(
  'load',
  () => {
    window.setTimeout(preloadScreens, 2_000);
  },
  { once: true },
);
