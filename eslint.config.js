import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'backend/node_modules/**', 'backend/data/**', 'backend/db/migrations/**'],
  },
  js.configs.recommended,
  // Frontend (browser, React)
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.browser, __APP_VERSION__: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    settings: { react: { version: 'detect' } },
    rules: {
      // Without these, a component referenced only in JSX (<Icon />) is reported
      // as "unused" and no-unused-vars invites deleting a binding that is in use.
      'react/jsx-uses-vars': 'error',
      'react/jsx-no-undef': 'error',
      ...reactHooks.configs.recommended.rules,
      // Legacy pages sync localStorage into state inside effects; cleaned up
      // in the frontend refactor phase. Warn instead of failing CI until then.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  // Backend and scripts (Node)
  {
    files: ['backend/**/*.js', 'scripts/**/*.js', '*.config.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_|^next$|^req$|^res$', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
]
