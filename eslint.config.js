import baseConfig from '@kitiumai/config/eslint.config.base.js';

export default [
  ...baseConfig,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      'no-restricted-imports': 'off',
    },
  },
];
