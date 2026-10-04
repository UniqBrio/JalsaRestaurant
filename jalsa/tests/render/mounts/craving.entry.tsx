/** Mounts the REAL CravingGame for a route and menu the spec hands in (craving-game.render.spec.ts). */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { CravingGame } from '../../../src/features/guest/CravingGame';
import { cravingPool, type CravingPhase, type CravingRoute } from '../../../src/lib/craving';
import type { FoodType } from '../../../src/lib/status';

declare global {
  interface Window {
    __route: CravingRoute;
    __menu: Array<{ id: string; name: string; foodType: FoodType; available: boolean }>;
    __phases: string[];
  }
}

function Harness() {
  const [phase, setPhase] = React.useState<CravingPhase>('offer');
  const [plays, setPlays] = React.useState(0);
  // Exactly as the order-placed screen builds it: the route's kind, from the menu.
  const targets = React.useMemo(() => cravingPool(window.__route, window.__menu), []);
  return (
    <CravingGame
      route={window.__route}
      targets={targets}
      menu={[]}
      orderedIds={[]}
      phase={phase}
      setPhase={(p) => {
        window.__phases.push(p);
        setPhase(p);
      }}
      plays={plays}
      setPlays={setPlays}
      onAdd={() => {}}
    />
  );
}

window.__phases = [];
const host = document.createElement('div');
host.id = 'game-host';
host.style.cssText = 'padding:16px;box-sizing:border-box;width:100%';
document.body.prepend(host);
createRoot(host).render(<Harness />);
