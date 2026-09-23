import base from '@jat/eslint-config/base';

export default [
  ...base,
  { ignores: ['src/generated/**'] },
  {
    // Nest injects by constructor type: these imports must stay value imports.
    rules: { '@typescript-eslint/consistent-type-imports': 'off' },
  },
];
