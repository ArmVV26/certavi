/**
 * The component catalog (`/dev/ui`) is a developer tool: it exists in `vite` (dev), in Vitest and
 * in the build the e2e suite serves (`vite build --mode e2e`, see playwright.config.ts), and it
 * is absent from the production build: no route, no link, and its code is dropped from the
 * bundle because this is a constant at build time.
 */
export const DEV_UI_ENABLED: boolean = import.meta.env.DEV || import.meta.env.MODE === 'e2e';
