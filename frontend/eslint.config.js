import js from '@eslint/js';
import react from 'eslint-plugin-react';
import globals from 'globals';

export default [
  { ignores: ['dist'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    plugins: { react },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: globals.browser,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error',
      'react/jsx-key': 'error',

      // seguridad: React escapa el texto, pero esto se salta esa proteccion
      'react/no-danger': 'error',
      'react/jsx-no-script-url': 'error',
      'react/jsx-no-target-blank': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-restricted-properties': ['error',
        { property: 'innerHTML', message: 'Usa JSX: React escapa el texto solo.' },
        { property: 'outerHTML', message: 'Usa JSX: React escapa el texto solo.' },
        { property: 'insertAdjacentHTML', message: 'Usa JSX: React escapa el texto solo.' },
        { object: 'document', property: 'write', message: 'No uses document.write.' },
      ],
    },
  },
];
