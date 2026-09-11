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
      <div className="flex items-center gap-4">
        <Image
          src="/brand/logo-light.svg"
          alt="Jalsa Restaurant, Hosur"
          width={220}
          height={54}
          className="dark:hidden"
          priority
        />
        <Image
          src="/brand/logo-dark.svg"
          alt="Jalsa Restaurant, Hosur"
          width={220}
          height={54}
          className="hidden dark:block"
          priority
        />
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
