// Conventional Commits, enforced on every commit by the husky commit-msg hook.
// Scopes come from context.md §7.2. A scope is optional (e.g. "ci: …" or "chore: …").
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'domain',
        'data',
        'sync',
        'api',
        'session',
        'today',
        'calendar',
        'routines',
        'exercises',
        'progress',
        'blocks',
        'settings',
        'ui',
        'theme',
        'i18n',
        'pwa',
        'claude',
        'release',
        'deps',
      ],
    ],
  },
};
