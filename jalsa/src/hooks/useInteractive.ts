'use client';
/**
 * useInteractive — false until this screen can actually answer a tap, then true for good.
 *
 * THE BUG THIS PREVENTS (26-Oct-2026, requests/2026-10-26-navigation-latency.md, N-01)
 *   A server-rendered screen is VISIBLE before it WORKS: its buttons are painted, but React has not
 *   attached their handlers until the page's JavaScript has arrived and run. On a phone in Hosur
 *   (modelled: 150 ms to Sydney, 9 Mbps, CPU 4x slower) that gap was 0.85-1.0 s at p50 on every
 *   surface. A tap in it is thrown away without a sign. On the PIN keypad one lost digit means the
 *   sign-in is never sent: on the rig 20 of 40 slow-phone sign-ins sat waiting for a screen that was not
 *   coming; with the keypads marked unavailable until this is true, 0 of 120.
 *
 *   A control that cannot answer yet should say so. Keypads are marked `aria-disabled` (the same dimmed
 *   look as their designed disabled state) until this turns true, so a tap is either kept or visibly not
 *   taken. `aria-disabled`, not `disabled`: a disabled button cannot take focus, and a keyboard user who
 *   focused a key before the page was ready would lose that focus.
 *
 * WHY useSyncExternalStore AND NOT AN EFFECT
 *   The server snapshot is `false` and the client snapshot `true`, so React itself switches it the
 *   moment hydration completes - no extra render, no effect, no flash on later client renders (a
 *   component mounted after hydration gets `true` immediately).
 */
import { useSyncExternalStore } from 'react';

const never = () => () => undefined;

export function useInteractive(): boolean {
  return useSyncExternalStore(
    never,
    () => true,
    () => false
  );
}
