// ESLint: catches mistakes the tests don't, e.g. a React hook with a missing dependency (a value
// that silently stops updating). Run with `npm run lint`. Dev-only; nothing here ships in the site.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist', 'node_modules'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...js.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Components are used in JSX, which core ESLint doesn't see as a use; ignore capitalized names.
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  {
    files: ['tests/**/*.{js,jsx}'],
    languageOptions: { globals: { ...globals.node } },
  },
];
