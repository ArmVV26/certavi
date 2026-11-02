import type { ReactNode } from 'react';
import { ThemeProvider } from '../theme/ThemeProvider';

/** App-wide providers. Router and i18n join here in feature/app-shell. */
export function Providers({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
