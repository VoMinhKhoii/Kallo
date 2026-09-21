'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { InviteCard } from '@/components/groups/meal-invites/invite-card';
import type { MealShareInvite } from '@/lib/actions/meal-sharing/types';

/** Peek layers drawn behind the front card, nearest first. */
const LAYERS = [
  'inset-x-2 translate-y-1.5 shadow-xs',
  'inset-x-4 translate-y-3 shadow-2xs',
] as const;

/**
 * The pending offers as one deck rather than a column.
 *
 * There is no cap on how many meals a friend can send, and every invite card
 * is 150–220px tall, so a flat list pushes the feed off the screen — web only
 * survived it by hiding the overflow inside the layout's `max-h-[35vh]`
 * scroller, which puts a second scrolling region on top of the feed's own.
 * Collapsed to a deck the inbox has ONE height whatever arrives.
 *
 * Only the front card is real. You dismiss it or take it and the next rises —
 * there is no browsing affordance, because there is no decision to make about
 * an offer you have not reached yet.
 *
 * The layers behind it are the SAME card, set back by an inset, a lighter step
 * on the shadow ramp, and a ring in the page colour that cuts each one away
 * from the card in front. Not a second surface colour: the palette has exactly
 * one card colour, tinting a back layer would spend the accent on chrome, and
 * fading it is the `bg-card/55` anti-pattern. `notification-parts.tsx` stacks
 * two avatars the same way.
 */
export function InviteDeck({ invites }: { invites: MealShareInvite[] }) {
  const reduceMotion = useReducedMotion();
  const [front] = invites;

  if (!front) {
    return null;
  }

  // One offer is not a deck. Drawing phantom layers under it would claim there
  // is something behind that the next tap does not produce.
  const layers = LAYERS.slice(0, Math.min(invites.length - 1, LAYERS.length));

  return (
    <div className="relative">
      {/* Bottom-up, so the nearest layer paints over the furthest one and each
          ring reads as an edge rather than a seam. Decoration only: no text to
          announce, no hit area to tab into — the count lives in the heading. */}
      {[...layers].reverse().map((layer) => (
        <div
          aria-hidden="true"
          className={`absolute inset-y-0 rounded-2xl border border-kallo-border/60 bg-white ring-1 ring-kallo-surface ${layer}`}
          data-testid="invite-deck-layer"
          key={layer}
        />
      ))}
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="relative"
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          key={front.id}
          transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        >
          <InviteCard invite={front} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
