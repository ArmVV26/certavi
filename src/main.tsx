import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './theme/fonts';
import './theme/tokens.css';
import './theme/global.css';
import { App } from './app/App';
import { Providers } from './app/Providers';
import { initTheme } from './theme/theme';

// Set data-theme before the first render so the first frame already has the right colours.
initTheme(window);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
);
