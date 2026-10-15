import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/**
 * Lint rules for src/ and tests/. Two kinds:
 *  - errors: things that are bugs (unused code, rules of hooks, undefined names). CI fails on these.
 *  - warnings: house rules the existing code does not meet yet (storage access outside the storage layer, console, any, size). CI allows no MORE warnings than `lint.baseline.json`
 *    (a ratchet: `npm run lint:ratchet`), so the numbers can only go down.
 * The Untitled UI library code (src/components/base, application, foundations, shared-assets) is vendored: not linted here.
 */
export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'public', 'tools/dwg-import', 'src/components/base/**', 'src/components/application/**', 'src/components/foundations/**', 'src/components/shared-assets/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts'],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // the classic hook rules are errors; the newer React-Compiler style checks are warnings until the existing code is cleaned up
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/refs': 'warn', 'react-hooks/set-state-in-effect': 'warn', 'react-hooks/purity': 'warn', 'react-hooks/use-memo': 'warn', 'react-hooks/globals': 'warn', 'react-hooks/immutability': 'warn', 'react-hooks/static-components': 'warn', 'react-hooks/preserve-manual-memoization': 'warn', 'react-hooks/incompatible-library': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-console': 'warn',
      // data goes through a StorageBackend (src/data/storage.ts), never straight to the browser
      'no-restricted-globals': ['warn', { name: 'localStorage', message: 'Use a StorageBackend (src/data/storage.ts).' }, { name: 'sessionStorage', message: 'Use a StorageBackend (src/data/storage.ts).' }],
      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
      complexity: ['warn', 30],
    },
  },
  { files: ['tools/**/*.{mjs,js,ts}', 'vite.config.ts', 'eslint.config.js', '*.cjs'], languageOptions: { globals: { ...globals.node } }, rules: { 'no-console': 'off' } },
  // the storage layer and the platform ports are the only places allowed to touch the browser's storage and console
  { files: ['src/data/storage.ts', 'src/platform/**/*.ts', 'tests/**/*.ts'], rules: { 'no-restricted-globals': 'off', 'no-console': 'off' } },
  { files: ['tests/**/*.ts'], rules: { 'max-lines': 'off', complexity: 'off', '@typescript-eslint/no-explicit-any': 'off' } },
);
