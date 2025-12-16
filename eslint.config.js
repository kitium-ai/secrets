/**
 * ESLint configuration for @kitiumai/secrets.
 * Composes the strict @kitiumai/lint presets (base + TS + Node + Security + Kitium).
 */

import {
  eslintBaseConfig,
  eslintKitiumConfig,
  eslintNodeConfig,
  eslintSecurityConfig,
  eslintTypeScriptConfig,
} from '@kitiumai/lint';

const normalize = (config) => (Array.isArray(config) ? config : [config]);

const fixNoRestrictedImports = (config) => {
  if (!config || typeof config !== 'object') {
    return config;
  }

  if (!('rules' in config) || !config.rules || typeof config.rules !== 'object') {
    return config;
  }

  const currentRule = config.rules['no-restricted-imports'];
  if (!Array.isArray(currentRule) || currentRule.length < 2) {
    return config;
  }

  const [level, options] = currentRule;
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return config;
  }

  const patterns = options.patterns;
  const message = options.message;
  if (
    !Array.isArray(patterns) ||
    !patterns.every((pattern) => typeof pattern === 'string') ||
    typeof message !== 'string'
  ) {
    return config;
  }

  return {
    ...config,
    rules: {
      ...config.rules,
      'no-restricted-imports': [
        level,
        {
          patterns: [
            {
              group: patterns,
              message,
            },
          ],
        },
      ],
    },
  };
};

const sharedPresets = [
  ...normalize(eslintBaseConfig).map(fixNoRestrictedImports),
  ...normalize(eslintTypeScriptConfig).map(fixNoRestrictedImports),
  ...normalize(eslintNodeConfig).map(fixNoRestrictedImports),
  ...normalize(eslintSecurityConfig).map(fixNoRestrictedImports),
  ...normalize(eslintKitiumConfig).map(fixNoRestrictedImports),
];

export default [
  {
    ignores: ['dist/', 'node_modules/', 'coverage/', '.turbo/', '**/*.d.ts'],
  },
  ...sharedPresets,
  {
    name: 'kitium/secrets-overrides',
    files: ['**/*.{ts,tsx,js,cjs,mjs}'],
    rules: {
      // Re-apply the shared import restriction with ESLint v9-compatible schema.
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: ['../../*', '../../../*'],
              message: 'Prefer module aliases over deep relative imports for maintainability.',
            },
          ],
        },
      ],
      // Disabled temporarily due to eslint-plugin-import relying on CJS-only minimatch.
      'import/order': 'off',
      // Avoid noisy false positives for key-based lookups on typed records/maps.
      'security/detect-object-injection': 'off',
    },
  },
];
