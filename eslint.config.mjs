// ESLint flat config.
//
//   * typescript-eslint recommended  — type-aware rules and common
//     correctness checks.
//   * eslint-plugin-security recommended — flags things like
//     `arr[i]` with non-literal `i`, dynamic-key bracket writes on
//     plain objects, and fs calls with non-literal paths. See #10
//     for the patterns the codebase adopted to satisfy this rule
//     (Map for dynamic-key collections, .at() for state-indexed
//     array access, Reflect.get for single dynamic reads, and
//     per-line // eslint-disable-next-line with a one-line
//     justification for fs-filename on operator-supplied paths).
//
// The config is intentionally minimal. Add project-specific rules
// in this file as they earn their keep.
import tseslint from 'typescript-eslint';
import security from 'eslint-plugin-security';

export default [
  ...tseslint.configs.recommended,
  {
    plugins: { security },
    rules: { ...security.configs.recommended.rules },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'test/**',
      'eslint.config.mjs',
    ],
  },
];
