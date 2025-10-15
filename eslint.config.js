import globals from 'globals';
import importPlugin from 'eslint-plugin-import';
import js from '@eslint/js';
import nPlugin from 'eslint-plugin-n';
import promisePlugin from 'eslint-plugin-promise';
import stylistic from '@stylistic/eslint-plugin';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  // Global ignores
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/es5/**',
      '**/*.min.js',
      '**/build-output*.log'
    ]
  },

  // Base config for all JavaScript and TypeScript files
  {
    files: ['**/*.js', '**/*.ts'],
    languageOptions: {
      ecmaVersion: 2018,
      sourceType: 'module',
      parser: tsparser,
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2017,
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly',
        globalThis: false
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      '@stylistic': stylistic,
      'import': importPlugin,
      'promise': promisePlugin,
      'n': nPlugin
    },
    rules: {
      // ESLint recommended rules
      ...js.configs.recommended.rules,

      // TypeScript rules
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-this-alias': 'off',

      // Core ESLint rules
      'accessor-pairs': 'error',
      'array-callback-return': 'error',
      'arrow-body-style': 'off',
      'block-scoped-var': 'error',
      'camelcase': 'error',
      'capitalized-comments': 'off',
      'class-methods-use-this': 'off',
      'complexity': 'off',
      'consistent-return': 'warn',
      'consistent-this': ['error', 'self'],
      'curly': 'error',
      'default-case': 'off',
      'dot-notation': ['error', { allowKeywords: true }],
      'eqeqeq': 'error',
      'func-name-matching': 'off',
      'func-names': 'off',
      'func-style': ['error', 'declaration', { allowArrowFunctions: true }],
      'guard-for-in': 'off',
      'id-length': 'off',
      'id-match': 'error',
      'init-declarations': 'off',
      'lines-around-comment': 'off',
      'lines-between-class-members': 'off',
      'max-classes-per-file': 'off',
      'max-depth': 'error',
      'max-len': 'off',
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'max-nested-callbacks': 'error',
      'max-params': 'off',
      'max-statements': 'off',
      'new-cap': 'error',
      'newline-per-chained-call': 'off',
      'no-alert': 'error',
      'no-array-constructor': 'error',
      'no-await-in-loop': 'error',
      'no-bitwise': 'off',
      'no-caller': 'error',
      'no-confusing-arrow': 'off',
      'no-console': 'error',
      'no-const-assign': 'error',
      'no-continue': 'off',
      'no-div-regex': 'error',
      'no-duplicate-imports': 'error',
      'no-else-return': ['error', { allowElseIf: true }],
      'no-empty-function': 'off',
      'no-eq-null': 'error',
      'no-eval': 'error',
      'no-extend-native': 'error',
      'no-extra-bind': 'error',
      'no-extra-label': 'error',
      'no-extra-parens': 'off',
      'no-global-assign': 'error',
      'no-implicit-globals': 'error',
      'no-implied-eval': 'error',
      'no-inline-comments': 'off',
      'no-inner-declarations': ['error', 'functions'],
      'no-invalid-this': 'error',
      'no-iterator': 'error',
      'no-label-var': 'error',
      'no-labels': 'error',
      'no-lone-blocks': 'error',
      'no-lonely-if': 'error',
      'no-loop-func': 'error',
      'no-magic-numbers': 'off',
      'no-mixed-operators': 'off',
      'no-multi-assign': 'off',
      'no-multi-spaces': 'off',
      'no-multi-str': 'off',
      'no-negated-condition': 'off',
      'no-nested-ternary': 'off',
      'no-new': 'error',
      'no-new-func': 'error',
      'no-new-object': 'error',
      'no-new-wrappers': 'error',
      'no-octal-escape': 'error',
      'no-param-reassign': 'off',
      'no-plusplus': 'off',
      'no-proto': 'error',
      'no-redeclare': ['error', { builtinGlobals: false }],
      'no-restricted-globals': 'error',
      'no-restricted-imports': 'error',
      'no-restricted-properties': 'error',
      'no-restricted-syntax': 'error',
      'no-return-assign': 'error',
      'no-return-await': 'error',
      'no-script-url': 'error',
      'no-self-compare': 'error',
      'no-sequences': 'error',
      'no-shadow': 'off',
      'no-template-curly-in-string': 'error',
      'no-ternary': 'off',
      'no-throw-literal': 'error',
      'no-undef': ['error', { typeof: false }],
      'no-undef-init': 'error',
      'no-undefined': 'error',
      'no-underscore-dangle': 'off',
      'no-unmodified-loop-condition': 'error',
      'no-unneeded-ternary': 'error',
      'no-unsafe-negation': 'error',
      'no-unused-expressions': 'error',
      'no-unused-vars': ['warn', { vars: 'all', args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-use-before-define': ['error', { functions: false }],
      'no-useless-call': 'error',
      'no-useless-computed-key': 'error',
      'no-useless-concat': 'error',
      'no-useless-constructor': 'off',
      'no-useless-rename': 'error',
      'no-useless-return': 'off',
      'no-var': 'off',
      'no-void': 'error',
      'no-warning-comments': 'warn',
      'no-with': 'error',
      'object-shorthand': 'off',
      'one-var': ['error', 'never'],
      'operator-assignment': 'error',
      'prefer-arrow-callback': 'off',
      'prefer-const': 'off',
      'prefer-destructuring': 'off',
      'prefer-named-capture-group': 'off',
      'prefer-numeric-literals': 'error',
      'prefer-object-spread': 'off',
      'prefer-promise-reject-errors': 'off',
      'prefer-rest-params': 'off',
      'prefer-spread': 'off',
      'prefer-template': 'off',
      'radix': 'off',
      'require-await': 'error',
      'require-unicode-regexp': 'off',
      'sort-imports': 'error',
      'sort-keys': 'off',
      'sort-vars': 'error',
      'strict': 'off',
      'symbol-description': 'error',
      'vars-on-top': 'off',

      // Stylistic rules (moved from core ESLint)
      '@stylistic/array-bracket-newline': 'off',
      '@stylistic/array-bracket-spacing': ['error', 'never'],
      '@stylistic/array-element-newline': 'off',
      '@stylistic/arrow-parens': ['error', 'as-needed'],
      '@stylistic/arrow-spacing': ['error', { after: true, before: true }],
      '@stylistic/block-spacing': ['error', 'always'],
      '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
      '@stylistic/comma-dangle': 'off',
      '@stylistic/comma-spacing': ['error', { after: true, before: false }],
      '@stylistic/comma-style': ['error', 'last'],
      '@stylistic/computed-property-spacing': ['error', 'never'],
      '@stylistic/dot-location': ['error', 'property'],
      '@stylistic/eol-last': 'error',
      '@stylistic/func-call-spacing': 'error',
      '@stylistic/function-call-argument-newline': 'off',
      '@stylistic/function-paren-newline': 'off',
      '@stylistic/generator-star-spacing': 'error',
      '@stylistic/implicit-arrow-linebreak': 'off',
      '@stylistic/indent': ['error', 2, { SwitchCase: 1 }],
      '@stylistic/jsx-quotes': 'error',
      '@stylistic/key-spacing': 'error',
      '@stylistic/keyword-spacing': 'error',
      '@stylistic/line-comment-position': 'off',
      '@stylistic/linebreak-style': ['error', 'unix'],
      '@stylistic/max-len': 'off',
      '@stylistic/max-statements-per-line': 'off',
      '@stylistic/multiline-comment-style': 'off',
      '@stylistic/multiline-ternary': 'off',
      '@stylistic/new-parens': 'error',
      '@stylistic/no-confusing-arrow': 'off',
      '@stylistic/no-extra-parens': 'off',
      '@stylistic/no-floating-decimal': 'error',
      '@stylistic/no-mixed-operators': 'off',
      '@stylistic/no-mixed-spaces-and-tabs': 'error',
      '@stylistic/no-multi-spaces': 'off',
      '@stylistic/no-multiple-empty-lines': 'error',
      '@stylistic/no-tabs': 'error',
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/no-whitespace-before-property': 'off',
      '@stylistic/nonblock-statement-body-position': 'error',
      '@stylistic/object-curly-newline': 'error',
      '@stylistic/object-curly-spacing': ['error', 'always'],
      '@stylistic/object-property-newline': 'off',
      '@stylistic/one-var-declaration-per-line': 'error',
      '@stylistic/operator-linebreak': 'off',
      '@stylistic/padded-blocks': 'off',
      '@stylistic/padding-line-between-statements': 'error',
      '@stylistic/quote-props': ['error', 'consistent'],
      '@stylistic/quotes': ['error', 'single'],
      '@stylistic/rest-spread-spacing': ['error', 'never'],
      '@stylistic/semi': 'error',
      '@stylistic/semi-spacing': 'error',
      '@stylistic/semi-style': ['error', 'last'],
      '@stylistic/space-before-blocks': 'error',
      '@stylistic/space-before-function-paren': ['error', {
        anonymous: 'never',
        named: 'never',
        asyncArrow: 'always'
      }],
      '@stylistic/space-in-parens': ['error', 'never'],
      '@stylistic/space-infix-ops': 'error',
      '@stylistic/space-unary-ops': 'error',
      '@stylistic/spaced-comment': ['error', 'always'],
      '@stylistic/switch-colon-spacing': ['error', { after: true, before: false }],
      '@stylistic/template-curly-spacing': ['error', 'never'],
      '@stylistic/template-tag-spacing': 'error',
      '@stylistic/wrap-iife': 'error',
      '@stylistic/yield-star-spacing': 'error'
    }
  },

  // TypeScript declaration files (.d.ts) and test files
  {
    files: ['**/*.d.ts', 'tsdef/**/*.ts'],
    rules: {
      'no-use-before-define': 'off',
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-redeclare': 'off',
      '@typescript-eslint/no-unsafe-declaration-merging': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off'
    }
  },

  // Test files
  {
    files: ['test/**/*.js', 'test/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.mocha,
        ...globals.node
      }
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      'consistent-return': 'warn',
      'no-console': 'off',
      'no-unused-vars': 'warn',
      'no-undefined': 'off'
    }
  },

  // Script files (build/utility scripts)
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    rules: {
      'no-console': 'off'
    }
  }
];
