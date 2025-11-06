import globals from 'globals';
import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2018,
      sourceType: 'module',
      parser: tsparser,
      globals: {
        ...globals.node,
        ...globals.es2017,
        ...globals.mocha
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      '@stylistic': stylistic
    },
    rules: {
      ...js.configs.recommended.rules,

      '@stylistic/indent': ['error', 2],
      '@stylistic/quotes': ['error', 'single'],
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/eol-last': 'error',
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/max-len': ['error', { code: 140 }],
      '@stylistic/comma-spacing': 'error',

      'curly': 'error',
      'eqeqeq': ['error', 'allow-null'],
      'no-eval': 'error',
      'no-debugger': 'error',
      'no-duplicate-case': 'error',
      'no-empty': 'off',
      'no-fallthrough': 'error',
      'no-unused-expressions': 'error',
      'no-var': 'error',
      'radix': 'error',

      '@typescript-eslint/no-unused-vars': ['error'],
      '@typescript-eslint/no-inferrable-types': 'error',

      'no-console': ['error', { allow: ['warn', 'error', 'log'] }]
    }
  }
];
