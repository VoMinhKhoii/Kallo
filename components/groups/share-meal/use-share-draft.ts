'use client';

import { useMemo, useState } from 'react';
import type { PortionSeat } from '@/components/groups/share-meal/portion-battery';
import type { CircleMember } from '@/lib/actions/groups/types';
import {
  evenParts,
  MAX_PARTICIPANTS,
  partsAfterAdd,
  partsAfterRemoval,
  TOTAL_PARTS,
} from '@/lib/domain/social/splits/parts';

function initialsOf(label: string) {
  const words = label.trim().split(/\s+/u);
  if (words.length >= 2) {
    return (
      (words.at(-2)?.[0] ?? '') + (words.at(-1)?.[0] ?? '')
    ).toUpperCase();
  }
  return label.slice(0, 2).toUpperCase();
}

/**
 * The share being composed: who is at the table and how the dish divides.
 *
 * Lifted out of the dialog because these move together and the rules between
 * them are worth reading on their own — adding or removing a seat has to
 * rebalance the parts. Twin of `ShareMealDraft` in `share_meal_draft.dart`.
 */
export function useShareDraft(labels: { you: string; youInitial: string }) {
  const [seated, setSeated] = useState<CircleMember[]>([]);
  const [parts, setParts] = useState<number[]>(() => evenParts(2));

  const reset = () => {
    setSeated([]);
    setParts(evenParts(2));
  };

  const add = (member: CircleMember) => {
    if (seated.length + 1 >= MAX_PARTICIPANTS) {
      return;
    }
    // The first friend starts even; later ones take their floor from whoever
    // can most afford it, so adding someone never resets a hand-set split.
    setParts(seated.length === 0 ? evenParts(2) : partsAfterAdd(parts));
    setSeated([...seated, member]);
  };

  /** `seat` indexes the METER, where 0 is me — so a friend is `seat - 1`. */
  const removeSeat = (seat: number) => {
    const next = seated.filter((_, i) => i !== seat - 1);
    setParts(next.length === 0 ? evenParts(2) : partsAfterRemoval(parts, seat));
    setSeated(next);
  };

  const seats: PortionSeat[] = useMemo(
    () => [
      {
        id: 'me',
        initials: labels.youInitial,
        label: labels.you,
        parts: parts[0],
      },
      ...seated.map((m, i) => ({
        id: m.profile.userId,
        initials: initialsOf(m.profile.displayName ?? m.profile.handle),
        label: m.profile.displayName ?? m.profile.handle,
        parts: parts[i + 1],
      })),
    ],
    [labels.you, labels.youInitial, parts, seated]
  );

  return {
    seated,
    parts,
    seats,
    setParts,
    add,
    removeSeat,
    reset,
    splitEvenly: () => setParts(evenParts(seated.length + 1)),
    atCapacity: seated.length + 1 >= MAX_PARTICIPANTS,
    /** One entry per recipient, for the wire. */
    splitsPayload: () =>
      seated.map((m, i) => ({
        userId: m.profile.userId,
        parts: parts[i + 1],
      })),
    /** My own run, in parts. A whole-portion share keeps the entire dish. */
    keptParts: (isSplit: boolean) =>
      isSplit && seated.length > 0 ? parts[0] : TOTAL_PARTS,
  };
}
