'use client';

import { useSyncExternalStore } from 'react';
import { isLateNight } from '@/lib/core/date/time-of-day';

/**
 * Whether the viewer's clock is in the 22:00–05:00 stretch.
 *
 * The clock is a browser fact: the server has no idea what time it is where
 * the person is, so it must not guess. The server snapshot is therefore a flat
 * `false` — the daytime pose renders on the server and in the first client
 * pass, and React swaps in the sleeping pose on the first commit after
 * hydration. Reading `new Date()` during SSR instead would mismatch whenever
 * the two clocks disagree, which is the whole point of this hook (precedent:
 * `components/logging/sidebar/use-mobile-header-slot.ts`).
 *
 * There is nothing to subscribe to: the hour matters at render time only, and
 * a surface state that outlives 22:00 on screen can keep its daytime pose
 * until something else re-renders it.
 */
const subscribe = () => () => {};

const getIsLateNight = () => isLateNight(new Date().getHours());

const getServerSnapshot = () => false;

export function useIsLateNight(): boolean {
  return useSyncExternalStore(subscribe, getIsLateNight, getServerSnapshot);
}
