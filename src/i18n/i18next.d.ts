// Type-safe translation keys: t('nav.today') is checked against es.json at compile time.
import 'i18next';
import type es from './es.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof es };
  }
}
