/**
 * stack-select - the PURE stack-selection decision. No I/O, no prompts, no side effects.
 *
 * WHY THIS IS CODE AND NOT A PARAGRAPH
 *   "Prefer Expo for mobile-first applications" is a sentence, and a sentence produces a
 *   different answer depending on who reads it and how the day is going. The decision has five
 *   real outcomes and one of them is "ask" - which is exactly the kind of thing that gets
 *   skipped when it lives in prose. Written as a function it is testable, and §10's seven cases
 *   are executable rather than aspirational.
 *
 * WHAT IT DOES NOT DO
 *   It does not scaffold, migrate, or rewrite anything, and it never returns a verdict for an
 *   existing application beyond "evaluate this properly". A policy that can silently condemn a
 *   working codebase to a rewrite is worse than no policy.
 *
 * THE DISTINCTION THE WHOLE THING TURNS ON
 *   **Mobile-responsive website** is not **mobile-first universal application**. Mobile browser
 *   support alone must NEVER select Expo - that is the single most likely wrong answer here,
 *   and `mobileWeb` is deliberately not a universal signal below.
 *
 * UNKNOWNS ARE NOT FALSE
 *   An input nobody supplied is `'unknown'`, and unknown inputs that could change the answer
 *   produce ASK, never a default. This is /request R2's rule applied to a decision instead of a
 *   form: an invented value reads exactly like a stated one and binds like one.
 */

/** Category A's stack, in the order a reader needs it. */
export const STACK_A = [
  'Expo', 'React Native', 'TypeScript', 'Expo Router', 'React Native Web', 'Supabase',
  'a React Native-compatible cross-platform UI system (NativeWind or equivalent)',
  'EAS Build / EAS Submit for native distribution', 'PWA support for the web target',
];

/** Category B's stack - and the framework's own `starter/`. */
export const STACK_B = [
  'Next.js', 'React', 'TypeScript', 'Supabase', 'a web UI/design system',
];

const yes = (v) => v === true || v === 'required' || v === 'future' || v === 'yes';
const known = (v) => v !== 'unknown' && v !== undefined && v !== null;

/**
 * @param {object} ctx  every field optional; anything absent is treated as 'unknown'
 * @returns {{category:'A'|'B'|'HYBRID'|'ASK'|'EXISTING', stack:string[], why:string, question?:string}}
 */
export function selectStack(ctx = {}) {
  const {
    seo = 'unknown', pwa = 'unknown', mobileFirst = 'unknown',
    android = 'unknown', ios = 'unknown',
    mobileWeb = 'unknown', tablet = 'unknown', desktopWeb = 'unknown',
    publicContent = 'unknown', existing = null,
  } = ctx;

  /* An EXISTING application is never re-categorised by this function. The policy prefers a
   * stack; it does not authorise a rewrite, and "the policy says so" is the worst possible
   * reason to migrate a working product. The decision is a human one, with costs this function
   * cannot see. */
  if (existing && existing.stack) {
    return {
      category: 'EXISTING',
      stack: [existing.stack],
      why: `An application already exists on ${existing.stack}`
        + `${existing.substantiallyImplemented ? ' and is substantially implemented' : ''}. `
        + 'Evaluate maturity, real requirements, migration cost, business benefit and future '
        + 'needs before proposing any change. If the current stack meets the requirements, keep it.',
    };
  }

  // Universal signals. NOTE what is absent: mobileWeb and tablet. A site that must work in a
  // phone browser is a responsive website, and responsive is what Category B already is.
  const universal = yes(pwa) || yes(mobileFirst) || yes(android) || yes(ios);
  const seoDominant = seo === 'high' || (publicContent === true && seo !== 'low');

  if (universal && seoDominant) {
    return {
      category: 'HYBRID',
      stack: [...new Set([...STACK_B, ...STACK_A])],
      why: 'Both a significant SEO/public web experience and a mobile-first universal '
        + 'application are required. Evaluate splitting them - Next.js for the public web, '
        + 'Expo/React Native for the application - against shared functionality, maintenance '
        + 'cost, code reuse, authentication and team capability. Do NOT split merely because it '
        + 'is technically possible; a split is two products to keep in step.',
    };
  }

  if (universal) {
    return { category: 'A', stack: STACK_A, why: 'A mobile-first universal application: ' + reasons(ctx).join(' · ') };
  }

  if (seoDominant) {
    return { category: 'B', stack: STACK_B, why: 'SEO/public web is the dominant requirement and no universal-application requirement was stated.' };
  }

  /* Nothing selected A, and the inputs that COULD have are unknown. One question separates the
   * two paths, so ask it rather than defaulting - a default here decides the architecture. */
  if (![pwa, mobileFirst, android, ios].some(known)) {
    return {
      category: 'ASK',
      stack: [],
      why: 'No universal-application requirement is stated, and the inputs that would establish '
        + 'one are unknown. The answer changes the architecture, so it is material.',
      question: 'Does this need to be installable (PWA) or shipped to the app stores now or '
        + 'later - or is working well in a mobile browser enough? '
        + 'Installable/native means Expo + React Native; a mobile browser means Next.js.',
    };
  }

  // Business workflow, mobile browser at most, PWA and native explicitly not required.
  return {
    category: 'B',
    stack: STACK_B,
    why: 'A responsive web application: mobile browser support is required but installability '
      + 'and native distribution are not. Mobile-responsive is not mobile-first universal.',
  };
}

function reasons(ctx) {
  const out = [];
  if (yes(ctx.mobileFirst)) out.push('mobile-first is a primary requirement');
  if (yes(ctx.pwa)) out.push('installable as a PWA');
  if (yes(ctx.android)) out.push(`Android ${ctx.android === 'future' ? 'expected later' : 'required'}`);
  if (yes(ctx.ios)) out.push(`iOS ${ctx.ios === 'future' ? 'expected later' : 'required'}`);
  if (ctx.desktopWeb === true) out.push('desktop browser required');
  if (ctx.tablet === true) out.push('tablet required');
  return out.length ? out : ['a universal-application requirement was stated'];
}

/** The record §8 asks for, rendered from a decision. Concise on purpose. */
export function renderRecord(ctx, decision) {
  const v = (x, d = 'unknown') => (known(x) ? String(x) : d);
  return [
    `APPLICATION TYPE:   ${decision.category === 'EXISTING' ? 'existing - evaluate, do not assume' : decision.category}`,
    `PRIMARY MODEL:      ${v(ctx.primaryModel, 'unknown')}`,
    `SEO:                ${v(ctx.seo)}`,
    `PWA:                ${v(ctx.pwa)}`,
    `MOBILE-FIRST:       ${v(ctx.mobileFirst)}`,
    `ANDROID:            ${v(ctx.android)}`,
    `IOS:                ${v(ctx.ios)}`,
    `MOBILE WEB:         ${v(ctx.mobileWeb)}`,
    `TABLET:             ${v(ctx.tablet)}`,
    `DESKTOP WEB:        ${v(ctx.desktopWeb)}`,
    `SELECTED STACK:     ${decision.stack.length ? decision.stack.join(', ') : '(undecided - see the question)'}`,
    `RATIONALE:          ${decision.why}`,
    `KEY TRADE-OFF:      ${v(ctx.tradeOff, 'state it')}`,
    `REVISIT TRIGGERS:   ${v(ctx.revisit, 'app-store distribution becomes required; SEO becomes material; the public and authenticated halves diverge')}`,
  ].join('\n');
}
