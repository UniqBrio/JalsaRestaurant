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

/**
 * THE DATA-LAYER BOUNDARY (CP-34, docs/28 §7). Supabase access lives here and nowhere else.
 * Configurable per application - this is the starter's shape, not an assumption about yours.
 * Keep it in step with `dataLayer` in .supabase-safety.json: gate step G14 enforces the same
 * boundary from the other side, so the two lists must agree or one of them lies.
 */
const DATA_LAYER = ['src/lib/data/**', 'api/**', 'supabase/functions/**'];

export default tseslint.config(
  { ignores: ['node_modules/**', '.next/**', 'dist/**', 'playwright-report/**', 'test-results/**',
              'public/**', 'src/theme/tokens.generated.*'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Everywhere EXCEPT the data layer: a `.from(` or `.rpc(` is a Supabase read constructed by a
    // component, which bypasses the bound, the order, the keyset helper and the truncation guard
    // all at once. The `.from(` rule matches the CHAIN SHAPE - `x.from(...)` immediately followed
    // by `.select(` / `.insert(` / `.update(` / `.upsert(` / `.delete(` - not the method name: a
    // receiver blocklist cannot know that `status.from('active')` is a label lookup, and the
    // first version of this rule flagged exactly that in a spec. A wrapper the app writes should
    // live in the data layer, where this rule does not apply.
    ignores: DATA_LAYER,
    rules: {
      'no-restricted-syntax': ['error',
        {
          selector: "MemberExpression[property.name=/^(select|insert|update|upsert|delete)$/]"
            + " > CallExpression.object[callee.type='MemberExpression'][callee.property.name='from']",
          message: 'Supabase reads belong in the data layer (src/lib/data, api, supabase/functions), where the bound, the order and the truncation guard live. CP-34, docs/28 §7.',
        },
        {
          selector: "CallExpression[callee.type='MemberExpression'][callee.property.name='rpc']",
          message: 'Supabase RPC calls belong in the data layer - a set-returning RPC is capped exactly like a table read, and there is no RPC exemption. CP-34, docs/28 §7.',
        },
      ],
    },
  },
);
