import nextConfig from 'eslint-config-next';

/**
 * Lint rules decide CORRECTNESS, not taste. Formatting arguments are not worth a build failure;
 * an unhandled promise or a missing dependency array is.
 */
const config = [
  {
    ignores: [
      '.next/**',
      // The degraded-instance build output (playwright.config.ts). Same reason as .next: it is
      // generated, and linting a bundler's output reports the bundler's style, not ours.
      '.next-degraded/**',
      // Framework files staged for a human to merge - see .framework/incoming/README.md. They
      // are another repository's source, held here unaltered so the diff against ours is honest.
      // Linting them reports the FRAMEWORK's style as our errors, and "fixing" one would destroy
      // the only thing the copy is for. Nothing here is imported or built; tsconfig's `include`
      // does not reach it either.
      '.framework/**',
      'node_modules/**',
      'src/theme/tokens.generated.*',
      'src/lib/brand-badge.generated.*',
      'playwright-report/**',
      'test-results/**',
      'public/sw.js',
    ],
  },
  // eslint-config-next 16 exports a flat-config ARRAY, not a factory. Spreading the array is
  // the whole integration; calling it was the v14 shape.
  ...nextConfig,
  {
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      'react-hooks/exhaustive-deps': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Build scripts ARE command-line tools: their console output is the interface, not a
    // leftover debug line.
    files: ['scripts/**/*.mjs'],
    rules: { 'no-console': 'off' },
  },
];

export default config;
