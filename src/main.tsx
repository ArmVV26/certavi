import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './theme/fonts';
import './theme/tokens.css';
import './theme/global.css';
import { App } from './app/App';
import { Providers } from './app/Providers';
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

startDatabase(db, navigator.storage)
  .catch((error: unknown) => {
    console.error('Could not start the local database', error);
  })
  .finally(() => {
    sync.start();
  });

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <Providers db={db} sync={sync}>
      <App />
    </Providers>
  </StrictMode>,
);
