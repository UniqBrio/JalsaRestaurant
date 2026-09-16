/**
 * ESLint - gate G6. Flat config, because that is the only kind ESLint 9+ reads.
 *
 * WHAT IS IN, AND WHY THIS LITTLE
 *   The two recommended sets - JavaScript's and typescript-eslint's - and nothing else. Style is
 *   cheap and a formatter's job; the value of a linter is the correctness rules it can actually
 *   decide, and the recommended sets are exactly those. Rules are added here when a real defect
 *   shows one would have caught it, and each such addition names that defect.
 *
 * WHAT IS OUT
 *   Generated files (the linter would be auditing the theme builder), build output, test
 *   artifacts, and `public/` - served bytes, not source. The service worker lives there on
 *   purpose: it must be served from the scope root, and it is reviewed as the deliberately small
 *   file it is rather than as application code.
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/**', '.next/**', 'dist/**', 'playwright-report/**', 'test-results/**',
              'public/**', 'src/theme/tokens.generated.*'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
