//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default [
  ...tanstackConfig,
  {
    plugins: {
      'react-hooks': reactHooks,
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      'import/no-cycle': 'off',
      'import/order': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
      'pnpm/json-enforce-catalog': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      // Defensive `?? default` on values TS believes are non-nullable is
      // intentional pre-noUncheckedIndexedAccess: tsconfig has the flag off,
      // so arr[0] etc. read as T but can be undefined at runtime. Demote to
      // warn rather than rewrite every guard.
      '@typescript-eslint/no-unnecessary-condition': 'warn',
    },
  },
  {
    ignores: [
      'eslint.config.js',
      'prettier.config.js',
      'commitlint.config.mjs',
      'public/**',
      'dist/**',
      'src/routeTree.gen.ts',
    ],
  },
]
