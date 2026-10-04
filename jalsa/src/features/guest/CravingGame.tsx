'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, FoodMark, SectionLabel } from '@/components/ui/atoms';
import { cn } from '@/lib/cn';
import {
  CATCH_POINTS,
  CRAVING_LIVES,
  CRAVING_MAX_PLAYS,
  CRAVING_SECONDS,
  ENEMY,
  ENEMY_PENALTY,
  FRESH_SCORE,
  POINTS_PER_LEVEL,
  ROUTE_KIND,
  cravingSuggestions,
  clampPlate,
  dropIsEnemy,
  isCaught,
  levelForScore,
  levelRules,
  scoreLanding,
  type CravingItem,
  type CravingPhase,
  type CravingRoute,
  type CravingScore,
  type CravingSuggestion,
  type CravingTarget,
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
 * WHAT FALLS (03-Oct-2026, revised 04-Oct-2026)
 *   Every available dish on the menu of the table's own kind - a Non-veg order drops the Non-veg
 *   dishes, a Veg order the Veg ones (`cravingPool`) - each as an emoji and its name, and one germ
 *   to avoid. A dish on the plate scores 10; a dish that falls past, or a germ on the plate,
 *   costs one of five lives. There is no clock (04-Oct-2026: "do not stop"): the game runs until
 *   the lives are gone, and every 100 points is a new level - faster, busier, more germs, a
 *   smaller plate (`levelForScore`, `levelRules`). Shown on the order-placed screen only.
 *
 * WHAT IT NEVER DOES
 *   It sends nothing, stores nothing on the server, and reads nothing the phone did not already
 *   have. The falling dishes are the round in memory; the suggestions are the menu in memory.
 */

interface Falling {
  /** Unique per drop, so React keys never collide when the same dish falls twice. */
  key: number;
  /** A dish from the order, or null for the germ. */
  item: CravingTarget | null;
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
  /** What falls: the menu's dishes of the table's own kind (`cravingPool`). */
  targets: readonly CravingTarget[];
  /** The menu the phone already holds, for the suggestions at the end. Nothing is fetched. */
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
  targets,
  menu,
  orderedIds,
  phase,
  setPhase,
  plays,
  setPlays,
  onAdd,
}: CravingGameProps) {
  const reduced = useReducedMotion();
  const suggestions = React.useMemo(
    () => cravingSuggestions(route, menu, orderedIds),
    [route, menu, orderedIds]
  );

  const [tally, setTally] = React.useState<CravingScore>(FRESH_SCORE);
  /* The latest tally, for the next landing to build on. Two drops can land in one frame; reading
     the rendered `tally` would let the second overwrite the first. Written only in event
     handlers - never inside a state updater, which React 19 runs twice. */
  const tallyRef = React.useRef<CravingScore>(FRESH_SCORE);
  /** Where the game has climbed to - the SCORE's, never chosen by the guest and never the clock's. */
  const level = levelForScore(tally.score);
  const rules = levelRules(level);
  /** What the last landing did, said once under the area ("+10 Biryani", "Germ! −15"). */
  const [lastEvent, setLastEvent] = React.useState('');
  const [falling, setFalling] = React.useState<Falling[]>([]);
  /** The plate's centre, as a percentage of the play area. Starts in the middle. */
  const [plate, setPlate] = React.useState(50);
  const areaRef = React.useRef<HTMLDivElement | null>(null);
  const dropSeq = React.useRef(0);
  /* The targets through a ref, so the timers below do not depend on them. The round is replaced
     on every live-data refresh - the round going to Preparing, a reply - which is to say during
     exactly the wait this game fills; as a dependency it restarted the 24 s stop each time
     (30-Sep review). */
  const targetsRef = React.useRef(targets);
  React.useEffect(() => {
    targetsRef.current = targets;
  }, [targets]);

  const playing = phase === 'playing';

  /*
    THE CLOCK - for the reduced-motion game only (04-Oct-2026). The falling game has none: it
    runs until the lives are gone ("do not stop"). The tap game drops nothing, so nothing can be
    missed and lives alone might never end it; it keeps the 30 s stop.
  */
  React.useEffect(() => {
    if (!playing || !reduced) return;
    const stop = setTimeout(() => setPhase('done'), CRAVING_SECONDS * 1000);
    return () => clearTimeout(stop);
  }, [playing, reduced, setPhase]);

  /*
    THE SPAWNER - its own effect, keyed on the level, because each level drops at its own pace.
    Under reduced motion nothing falls, so nothing spawns.
  */
  React.useEffect(() => {
    if (!playing || reduced) return;
    const spawn = setInterval(() => {
      const pool = targetsRef.current;
      if (pool.length === 0) return;
      /* Key, kind and position decided HERE, not inside the updater: an updater reading the ref
         late gave two ticks before one render the same key, and one landing removed both. */
      const key = ++dropSeq.current;
      const item = dropIsEnemy(level, Math.random()) ? null : (pool[Math.floor(Math.random() * pool.length)] ?? null);
      // 10-90% keeps a whole item inside the area at 320px, where it is narrowest.
      const left = 10 + Math.random() * 80;
      setFalling((cur) => [...cur, { key, item, left }]);
    }, levelRules(level).spawnMs);
    return () => clearInterval(spawn);
  }, [playing, reduced, level]);

  /* Out of lives and the round is over - the rule the lives counter promises. An effect, not a
     line inside the score updater: React 19 runs updaters twice, and a side effect there would
     end the game twice. */
  React.useEffect(() => {
    if (playing && tally.lives === 0) setPhase('done');
  }, [playing, tally.lives, setPhase]);

  const begin = () => {
    tallyRef.current = FRESH_SCORE;
    setTally(FRESH_SCORE);
    setLastEvent('');
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
    setPlate(clampPlate(pct, rules.plateWidthPct));
  };

  const record = (kind: 'food' | 'enemy', onPlate: boolean, name: string) => {
    const before = tallyRef.current;
    const next = scoreLanding(before, kind, onPlate);
    if (next === before) return; // a germ that fell past: nothing happened
    tallyRef.current = next;
    setTally(next);
    const up = levelForScore(next.score);
    if (up > levelForScore(before.score)) {
      // The plate narrows as the game climbs; keep it wholly inside the area at its new width.
      setPlate((p) => clampPlate(p, levelRules(up).plateWidthPct));
      setLastEvent(`Level up! Level ${up} — faster now`);
    } else if (kind === 'food') {
      setLastEvent(onPlate ? `+${CATCH_POINTS} ${name}` : `Missed ${name} — −1 life`);
    } else {
      setLastEvent(`${ENEMY.name}! −${ENEMY_PENALTY} and −1 life`);
    }
  };

  /**
   * The hit test, asked once per drop, at the moment it is level with the plate.
   *
   * The reach and the clamp both come from the level's plate width, so the plate that is drawn,
   * the plate that can be moved and the plate that catches are provably the same plate.
   */
  const landed = (drop: Falling) => {
    setFalling((cur) => cur.filter((f) => f.key !== drop.key));
    record(drop.item ? 'food' : 'enemy', isCaught(drop.left, plate, rules.plateWidthPct), drop.item?.name ?? ENEMY.name);
  };

  /* ── The offer ───────────────────────────────────────────────────────────────────────────── */

  if (phase === 'offer') {
    return (
      <Card className="flex w-full flex-col gap-2 text-left" data-testid="craving-offer">
        <SectionLabel>Catch Your Craving</SectionLabel>
        <p className="m-0 type-body font-semibold">Catch the food. Avoid the bad item!</p>
        <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]" data-testid="craving-offer-items">
          {`Every ${ROUTE_KIND[route]} dish on tonight's menu falls — never catch the ${ENEMY.emoji}, never drop a dish. ${CRAVING_LIVES} lives; every ${POINTS_PER_LEVEL} points it gets faster.`}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Button data-testid="craving-start" size="sm" onClick={begin}>
            Play
          </Button>
          <Button data-testid="craving-skip" size="sm" variant="ghost" onClick={() => setPhase('dismissed')}>
            Maybe later
          </Button>
        </div>
      </Card>
    );
  }

  /* ── The ending ──────────────────────────────────────────────────────────────────────────── */

  if (phase === 'done') {
    return (
      <Card className="flex w-full flex-col gap-3 text-left" data-testid="craving-done">
        <div>
          {/* Why it stopped early, when it did: three germs end the round before the clock. */}
          {tally.lives === 0 ? (
            <p className="m-0 mb-1 type-caption font-semibold text-[var(--error)]" data-testid="craving-out">
              Out of lives — that round is over.
            </p>
          ) : null}
          {/* "Nice catch!" only for a catch: after a Skip or an empty plate it sat above "the
              kitchen is still working", contradicting it (30-Sep review). */}
          {tally.caught > 0 ? (
            <>
              <p className="m-0 type-h3">Nice catch! 🍽️</p>
              <p className="m-0 mt-0.5 type-body font-semibold tabular-nums" data-testid="craving-final-score">
                {`${tally.score} points · reached Level ${level}`}
              </p>
              <p className="m-0 mt-0.5 type-caption text-[var(--text-muted)]" data-testid="craving-score">
                {`You caught ${tally.caught} ${tally.caught === 1 ? 'dish' : 'dishes'}`}
                {tally.germs > 0 ? ` and ${tally.germs} ${tally.germs === 1 ? 'germ' : 'germs'}` : ''}
                {tally.missed > 0 ? `, and let ${tally.missed} fall.` : '.'}
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
            <Button data-testid="craving-again" size="sm" variant="secondary" onClick={begin}>
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
    <Card className="flex w-full flex-col gap-2 text-left" data-testid="craving-playing" data-level={level}>
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>
          {'Catch Your Craving · '}
          <span data-testid="craving-level">{`Level ${level}`}</span>
        </SectionLabel>
        <span className="flex items-center gap-3 type-caption tabular-nums">
          <span data-testid="craving-lives" aria-label={`${tally.lives} of ${CRAVING_LIVES} lives left`}>
            {`Lives ${tally.lives}`}
          </span>
          <span className="font-bold" data-testid="craving-live-score" aria-label={`${tally.score} points`}>
            {`${tally.score} points`}
          </span>
        </span>
      </div>

      {reduced ? (
        /* THE SAME GAME, WITHOUT MOTION. Tap your dishes; leave the germ alone. The requester
           asked that the concept survive rather than the feature disappear, and a tap target is
           also the most reliable interaction on any device. */
        <div className="flex flex-wrap gap-2" data-testid="craving-reduced">
          {targets.slice(0, 6).map((item) => (
            <button
              key={item.id}
              type="button"
              data-testid={`craving-tap-${item.id}`}
              onClick={() => record('food', true, item.name)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--primary-surface)] px-4 type-caption font-semibold text-[var(--on-primary-surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
            >
              <span aria-hidden>{item.emoji}</span>
              {item.name}
            </button>
          ))}
          <button
            type="button"
            data-testid="craving-tap-enemy"
            onClick={() => record('enemy', true, ENEMY.name)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--error-surface)] px-4 type-caption font-semibold text-[var(--on-error-surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
          >
            <span aria-hidden>{ENEMY.emoji}</span>
            {ENEMY.name}
          </button>
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
              data-testid={drop.item ? 'craving-food' : 'craving-enemy'}
              onAnimationEnd={() => landed(drop)}
              style={{ left: `${drop.left}%`, animationDuration: `${rules.fallMs}ms` }}
              className={cn(
                // A long name wraps to two lines (04-Oct-2026) rather than running off the edge.
                'j-craving-fall absolute top-0 flex w-max max-w-[7.5rem] -translate-x-1/2 flex-col items-center text-center',
                'rounded-[var(--radius-md)] px-1.5 py-0.5 type-caption font-semibold leading-tight shadow-[var(--shadow-raised)]',
                drop.item ? 'bg-[var(--surface)]' : 'bg-[var(--error-surface)] text-[var(--on-error-surface)]'
              )}
            >
              {/* A small wobble on the way down - CSS only, and collapsed under reduced motion. */}
              <span aria-hidden className="j-craving-wobble inline-block type-h3 leading-none">
                {drop.item ? drop.item.emoji : ENEMY.emoji}
              </span>
              <span className="line-clamp-2">{drop.item ? drop.item.name : ENEMY.name}</span>
            </span>
          ))}

          {/* The plate - a dinner plate seen from the side: a maroon rim (Jalsa's own colour), a
              gold dotted band inside it like fine china, and a shaded well at the centre
              (04-Oct-2026: "enhance plate appearance, it's plain"). Every colour is a token.
              Its top sits where the old bar's did (bottom 0.25rem + height 1rem = 1.25rem), so
              `j-craving-fall` still ends every drop level with it.
              `transition` on `left` alone, so following a thumb stays smooth without animating
              anything else. */}
          <span
            data-testid="craving-plate"
            aria-hidden
            style={{ left: `${plate}%`, width: `${rules.plateWidthPct}%` }}
            className={cn(
              'absolute bottom-1 flex h-4 -translate-x-1/2 items-center justify-center rounded-[50%] border-2 border-[var(--primary)] bg-[var(--surface)] shadow-[var(--shadow-raised)]',
              'transition-[left] duration-75 ease-out'
            )}
          >
            <span className="flex h-[70%] w-[82%] items-center justify-center rounded-[50%] border border-dotted border-[var(--warning)]">
              <span className="h-[70%] w-[70%] rounded-[50%] bg-[var(--surface-sunken)] shadow-[inset_0_1px_2px_var(--border)]" />
            </span>
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 type-caption text-[var(--text-muted)]" aria-live="polite" data-testid="craving-event">
          {lastEvent ||
            (reduced
              ? `Tap your dishes · avoid the ${ENEMY.emoji}`
              : `Slide the plate to catch your food · avoid the ${ENEMY.emoji}`)}
        </p>
        <Button data-testid="craving-stop" size="sm" variant="ghost" onClick={() => setPhase('done')}>
          Skip
        </Button>
      </div>
    </Card>
  );
}
