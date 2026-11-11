import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    'dist',
    'dist-e2e',
    'coverage',
    'playwright-report',
    'test-results',
    'blob-report',
    '.netlify',
    'node_modules',
  ]),

  // Base: JavaScript + TypeScript with type information (strict).
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // React app code.
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // Use the Dialog component instead (see .claude/rules/code-style.md).
      'no-alert': 'error',
    },
  },

  // Node-side TypeScript: tool configs, e2e tests, the sync server and the Netlify Functions.
  {
    files: ['*.config.ts', 'tests/**/*.ts', 'server/**/*.ts', 'netlify/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // No fixed waits in e2e tests (.claude/rules/e2e.md): use web-first assertions, `expect.poll`,
  // `page.clock` for app timers and `settle()` from tests/e2e/helpers.ts for "nothing happens".
  {
    files: ['tests/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='waitForTimeout']",
          message: 'No real-time waits in e2e tests: see .claude/rules/e2e.md.',
        },
      ],
    },
  },

  // Plain JS files (eslint/commitlint configs, scripts) are not part of any tsconfig.
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Scripts the page loads as they are (public/): they run in the browser, not in Node.
  {
    files: ['public/**/*.js'],
    languageOptions: {
      globals: globals.browser,
    },
  },

  // Must be last: turns off rules that conflict with Prettier.
  prettier,
]);
