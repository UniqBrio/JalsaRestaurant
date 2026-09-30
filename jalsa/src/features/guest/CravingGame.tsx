'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, FoodMark, SectionLabel } from '@/components/ui/atoms';
import { cn } from '@/lib/cn';
import {
  CRAVING_FALL_MS,
  CRAVING_MAX_PLAYS,
  CRAVING_SECONDS,
  CRAVING_SPAWN_MS,
  cravingPool,
  cravingSuggestions,
  clampPlate,
  isCaught,
  PLATE_WIDTH_PCT,
  ROUTE_LINE,
  type CravingItem,
  type CravingPhase,
  type CravingRoute,
  type CravingSuggestion,
} from '@/lib/craving';

/**
 * Catch Your Craving — the small moment while the kitchen works.
 *
 * WHY THERE IS NO ANIMATION LOOP IN THIS FILE
 *   Each falling item is a DOM element with one CSS keyframe animation. The compositor moves it;
 *   no JavaScript runs while it travels. The ONLY per-item JavaScript is one comparison when
 *   `animationend` fires — at that instant the item is level with the plate, so "did it land in
 *   the plate" is a single question asked once, rather than a hit test run sixty times a second.
 *
 *   That is the whole performance story: no `requestAnimationFrame`, no canvas, no engine, no
 *   dependency. Two timers exist — one spawning items, one ending the game — and both are
 *   cleared on unmount and on finish.
 *
 * WHY REDUCED MOTION IS A DIFFERENT GAME AND NOT A DIMMER ONE
 *   `tokens.generated.css` already collapses every animation to 1ms under
 *   `prefers-reduced-motion`. A falling game does not become calmer there; it becomes
 *   unplayable, because every item reaches the plate instantly. So the preference is read in
 *   JavaScript and a genuinely different variant is rendered: the same food, the same scoring,
 *   the same ending — tapped rather than caught. The concept survives; only the motion goes.
 *
 * WHAT IT NEVER DOES
 *   It sends nothing, stores nothing on the server, and reads nothing the phone did not already
 *   have. The pool and the suggestions are the menu already in memory.
 */

interface Falling {
  /** Unique per drop, so React keys never collide when the same dish falls twice. */
  key: number;
  item: CravingItem;
  /** Where it falls, as a percentage of the play area's width. */
  left: number;
}

/* At module scope, so it is one function for the page's life: an inline closure is a new
   `subscribe` every render, and useSyncExternalStore re-subscribes on each one - every spawn
   and every landing, mid-game (30-Sep review). */
function subscribeReducedMotion(onChange: () => void): () => void {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function useReducedMotion(): boolean {
  // `useSyncExternalStore` rather than an effect: the preference is external state, and reading
  // it into React state in an effect would schedule a second render on every mount.
  return React.useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    // On the server nobody has a preference and nothing is animating yet.
    () => false
  );
}

export interface CravingGameProps {
  route: CravingRoute;
  /** The menu the phone already holds. Nothing is fetched. */
  menu: ReadonlyArray<CravingSuggestion & CravingItem & { available: boolean }>;
  /** Item ids already in this order, so the ending does not suggest them again. */
  orderedIds: readonly string[];
  phase: CravingPhase;
  setPhase: (p: CravingPhase) => void;
  plays: number;
  setPlays: (n: number) => void;
  /** Adds one of the suggested items to the cart, through the ordinary cart path. */
  onAdd: (itemId: string) => void;
}

export function CravingGame({
  route,
  menu,
  orderedIds,
  phase,
  setPhase,
  plays,
  setPlays,
  onAdd,
}: CravingGameProps) {
  const reduced = useReducedMotion();
  const pool = React.useMemo(() => cravingPool(route, menu), [route, menu]);
  const suggestions = React.useMemo(
    () => cravingSuggestions(route, menu, orderedIds),
    [route, menu, orderedIds]
  );

  const [score, setScore] = React.useState(0);
  const [falling, setFalling] = React.useState<Falling[]>([]);
  /** The plate's centre, as a percentage of the play area. Starts in the middle. */
  const [plate, setPlate] = React.useState(50);
  const areaRef = React.useRef<HTMLDivElement | null>(null);
  const dropSeq = React.useRef(0);
  /* The pool through a ref, so the timers below do not depend on it. `menu` is replaced on
     every live-data refresh - a round going to Preparing, a reply, a dish selling out - which is
     to say during exactly the wait this game fills; as a dependency it restarted the 24 s stop
     each time (30-Sep review). */
  const poolRef = React.useRef(pool);
  React.useEffect(() => {
    poolRef.current = pool;
  }, [pool]);

  const playing = phase === 'playing';

  /*
    THE TWO TIMERS, AND THE ONLY TWO — one effect owning both, so there is exactly one cleanup
    and no way for one to survive the other. A guest who walks to the menu mid-game unmounts
    this component and leaves nothing running.

    Under reduced motion only the end timer is set: nothing falls there, so nothing spawns.
  */
  React.useEffect(() => {
    if (!playing) return;

    const stop = setTimeout(() => setPhase('done'), CRAVING_SECONDS * 1000);
    if (reduced) return () => clearTimeout(stop);

    const spawn = setInterval(() => {
      const pool = poolRef.current;
      const item = pool[Math.floor(Math.random() * pool.length)];
      if (!item) return;
      /* Key and position decided HERE, not inside the updater: an updater reading the ref late
         gave two ticks before one render the same key, and one landing removed both. */
      const key = ++dropSeq.current;
      // 10-90% keeps a whole item inside the area at 320px, where it is narrowest.
      const left = 10 + Math.random() * 80;
      setFalling((cur) => [...cur, { key, item, left }]);
    }, CRAVING_SPAWN_MS);

    return () => {
      clearInterval(spawn);
      clearTimeout(stop);
    };
  }, [playing, reduced, setPhase]);

  const begin = () => {
    setScore(0);
    setFalling([]);
    setPlate(50);
    setPlays(plays + 1);
    setPhase('playing');
  };

  /** One listener, on the play area itself — never on `document`, so there is nothing to leak. */
  const movePlate = (clientX: number) => {
    const box = areaRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const pct = ((clientX - box.left) / box.width) * 100;
    setPlate(clampPlate(pct));
  };

  /**
   * The hit test, asked once per item, at the moment it is level with the plate.
   *
   * Both the reach and the clamp come from `PLATE_WIDTH_PCT`, so the plate that is drawn, the
   * plate that can be moved and the plate that catches are provably the same plate.
   */
  const landed = (drop: Falling) => {
    setFalling((cur) => cur.filter((f) => f.key !== drop.key));
    if (isCaught(drop.left, plate)) setScore((s) => s + 1);
  };

  /* ── The offer ───────────────────────────────────────────────────────────────────────────── */

  if (phase === 'offer') {
    return (
      <Card className="flex flex-col gap-2" data-testid="craving-offer">
        <SectionLabel>Hungry while you wait?</SectionLabel>
        <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">{ROUTE_LINE[route]}</p>
        <div className="mt-1 flex flex-wrap gap-2">
          <Button data-testid="craving-start" onClick={begin}>
            Catch Your Craving
          </Button>
          <Button data-testid="craving-skip" variant="ghost" onClick={() => setPhase('dismissed')}>
            Maybe later
          </Button>
        </div>
      </Card>
    );
  }

  /* ── The ending ──────────────────────────────────────────────────────────────────────────── */

  if (phase === 'done') {
    return (
      <Card className="flex flex-col gap-3" data-testid="craving-done">
        <div>
          {/* "Nice catch!" only for a catch: after a Skip or an empty plate it sat above "the
              kitchen is still working", contradicting it (30-Sep review). */}
          {score > 0 ? (
            <>
              <p className="m-0 type-h3">Nice catch! 🍽️</p>
              <p className="m-0 mt-0.5 type-caption text-[var(--text-muted)]" data-testid="craving-score">
                {`You caught ${score} ${score === 1 ? 'dish' : 'dishes'}.`}
              </p>
            </>
          ) : (
            <p className="m-0 type-body font-semibold" data-testid="craving-score">
              The kitchen is still working — your food is the real prize.
            </p>
          )}
        </div>

        {suggestions.length > 0 ? (
          <div className="flex flex-col gap-2">
            <SectionLabel>Complete your meal?</SectionLabel>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {suggestions.map((s) => (
                <li key={s.id} className="flex items-center gap-2.5">
                  <FoodMark type={s.foodType} />
                  <span className="min-w-0 flex-1 truncate type-body">{s.name}</span>
                  <span className="type-caption tabular-nums text-[var(--text-muted)]">{s.priceLabel}</span>
                  <Button
                    data-testid={`craving-add-${s.id}`}
                    size="sm"
                    variant="secondary"
                    aria-label={`Add ${s.name}`}
                    onClick={() => onAdd(s.id)}
                  >
                    Add
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {plays < CRAVING_MAX_PLAYS ? (
            <Button data-testid="craving-again" size="sm" variant="ghost" onClick={begin}>
              Play again
            </Button>
          ) : null}
          <Button data-testid="craving-close" size="sm" variant="ghost" onClick={() => setPhase('dismissed')}>
            Close
          </Button>
        </div>
      </Card>
    );
  }

  /* ── Playing ─────────────────────────────────────────────────────────────────────────────── */

  return (
    <Card className="flex flex-col gap-2" data-testid="craving-playing">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>Catch Your Craving</SectionLabel>
        <span
          className="type-caption tabular-nums text-[var(--text-muted)]"
          data-testid="craving-live-score"
          aria-label={`${score} caught`}
        >
          {score}
        </span>
      </div>

      {reduced ? (
        /* THE SAME GAME, WITHOUT MOTION. Tap the dish to catch it. The requester asked that the
           concept survive rather than the feature disappear, and a tap target is also the most
           reliable interaction on any device. */
        <div className="flex flex-wrap gap-2" data-testid="craving-reduced">
          {pool.slice(0, 6).map((item) => (
            <button
              key={item.id}
              type="button"
              data-testid={`craving-tap-${item.id}`}
              onClick={() => setScore((s) => s + 1)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--primary-surface)] px-4 type-caption font-semibold text-[var(--on-primary-surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
            >
              <FoodMark type={item.foodType} />
              {item.name}
            </button>
          ))}
        </div>
      ) : (
        <div
          ref={areaRef}
          data-testid="craving-area"
          /* `touch-none` so dragging the plate never scrolls the page under the guest's thumb.
             `overflow-hidden` keeps a falling item from widening the page — the 320px rule. */
          className="relative h-52 w-full touch-none overflow-hidden rounded-[var(--radius-card)] bg-[var(--primary-surface)]"
          onPointerDown={(e) => movePlate(e.clientX)}
          onPointerMove={(e) => movePlate(e.clientX)}
        >
          {falling.map((drop) => (
            <span
              key={drop.key}
              data-testid="craving-food"
              onAnimationEnd={() => landed(drop)}
              style={{ left: `${drop.left}%`, animationDuration: `${CRAVING_FALL_MS}ms` }}
              className="j-craving-fall absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--surface)] px-2.5 py-1 type-caption font-semibold shadow-[var(--shadow-raised)]"
            >
              {drop.item.name}
            </span>
          ))}

          {/* The plate. `transition` on `left` alone, so following a thumb stays smooth without
              animating anything else. */}
          <span
            data-testid="craving-plate"
            aria-hidden
            style={{ left: `${plate}%`, width: `${PLATE_WIDTH_PCT}%` }}
            className={cn(
              'absolute bottom-2 h-3 -translate-x-1/2 rounded-full bg-[var(--primary)]',
              'transition-[left] duration-75 ease-out'
            )}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 type-caption text-[var(--text-muted)]">
          {reduced ? 'Tap what you fancy.' : 'Slide the plate. Catch what you fancy.'}
        </p>
        <Button data-testid="craving-stop" size="sm" variant="ghost" onClick={() => setPhase('done')}>
          Skip
        </Button>
      </div>
    </Card>
  );
}
