import Link from 'next/link';
import Image from 'next/image';

/**
 * The root.
 *
 * A guest never sees this: they arrive at /t/<table> by scanning a physical code. This page is
 * what a member of staff gets when they type the address, and what an operator gets when they
 * open the deployment to check it is alive. It therefore does one job — route a person to their
 * own surface — and does not pretend to be a landing page for a restaurant that has one already.
 */
export default function Home() {
  const surfaces = [
    {
      href: '/t/A5' as const,
      title: 'Guest — table A5',
      note: 'What a phone sees after scanning the tabletop code. Every table has its own address.',
      testId: 'home-guest',
    },
    {
      href: '/staff' as const,
      title: 'Captain and waiter',
      note: 'The floor, the rounds, the requests. Four-digit PIN.',
      testId: 'home-staff',
    },
    {
      href: '/owner' as const,
      title: 'Owner and admin',
      note: 'Live orders, closures, the menu, people and the audit log. Four-digit PIN.',
      testId: 'home-owner',
    },
  ];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[42rem] flex-col justify-center gap-6 px-4 py-12">
      {/* The authoritative badge, then the name as type — the composition every owner-console
          artboard uses. The pair of SVGs that stood here were a REDRAWN wordmark: a "J" glyph in
          a rounded square, not the restaurant's own mark. `/brand/jalsa-badge.png` is the design
          source's `assets/jalsa-logo.png`, byte for byte (md5 dfe5fe5c276f3fb06a6094f688be995c),
          and it carries its own maroon field, so it needs no light/dark pair — see `logo.badge`
          in design/tokens.json. */}
      <div className="flex items-center gap-4">
        <Image
          src="/brand/jalsa-badge.png"
          alt="Jalsa Restaurant, Hosur"
          width={56}
          height={56}
          className="shrink-0 rounded-[var(--radius-md)]"
          priority
        />
        <span className="flex min-w-0 flex-col">
          <span className="font-[family-name:var(--font-heading)] text-[var(--font-size-h1)] font-bold leading-[var(--line-height-h1)] text-[var(--text-heading)]">
            Jalsa Restaurant
          </span>
          <span className="text-[var(--font-size-caption)] leading-[var(--line-height-caption)] text-[var(--text-muted)]">
            Hosur
          </span>
        </span>
      </div>

      <p className="m-0 max-w-[36em] text-[13.5px] leading-relaxed text-[var(--text-muted)]">
        Scan → Order → Kitchen → Add More → Request Payment → Tip → Pay → Invoice → Review → Reconcile. Three
        surfaces, one bill, and the guest never marks it paid.
      </p>

      <nav className="flex flex-col gap-3">
        {surfaces.map((s) => (
          <Link
            data-testid={s.testId}
            key={s.href}
            href={s.href}

            className="rounded-[var(--radius-lg)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] transition-colors hover:bg-[var(--primary-surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
          >
            <span className="block text-[15px] font-semibold">{s.title}</span>
            <span className="mt-0.5 block text-[12.5px] leading-relaxed text-[var(--text-muted)]">{s.note}</span>
          </Link>
        ))}
      </nav>
    </main>
  );
}
