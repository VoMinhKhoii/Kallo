'use client';

import { useMemo, useState } from 'react';
import {
  initialsFor,
  labelFor,
} from '@/components/groups/invite/profile-identity';
import type { PortionSeat } from '@/components/groups/share-meal/portion/battery';
import type { CircleMember } from '@/lib/actions/groups/types';
import type { shareMealWithFriends } from '@/lib/domain/social/circle-client';
import {
  evenParts,
  MAX_PARTICIPANTS,
  partsAfterAdd,
  partsAfterRemoval,
  TOTAL_PARTS,
} from '@/lib/domain/social/splits/parts';

/**
 * The share being composed: who is at the table and how the dish divides.
 *
 * Lifted out of the dialog because these move together and the rules between
 * them are worth reading on their own — adding or removing a seat has to
 * rebalance the parts. Twin of `ShareMealDraft` in `share_meal_draft.dart`.
 */
/** The request body `shareMealWithFriends` takes — reused, never restated. */
export type ShareMealRequest = Parameters<typeof shareMealWithFriends>[0];

/** The draft, named so consumers depend on the real shape and not a copy. */
export type ShareDraft = ReturnType<typeof useShareDraft>;

/** The viewer, shaped like every other seat so seat 0 is not a special case.
 *  `label`/`initials` are localised ("You"/"Bạn") rather than derived from the
 *  name, which is why the caller resolves them and hands them over. */
export interface ShareViewer {
  label: string;
  initials: string;
  avatarUrl: string | null;
}

export function useShareDraft(viewer: ShareViewer) {
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
        avatarUrl: viewer.avatarUrl,
        initials: viewer.initials,
        label: viewer.label,
        parts: parts[0],
      },
      ...seated.map((m, i) => ({
        id: m.profile.userId,
        avatarUrl: m.profile.avatarUrl,
        initials: initialsFor(m.profile),
        label: labelFor(m.profile),
        parts: parts[i + 1],
      })),
    ],
    [viewer.avatarUrl, viewer.initials, viewer.label, parts, seated]
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
    /**
     * The whole request body, so the submit path never reassembles it.
     *
     * ALWAYS sends parts for a split, even an untouched even one: 20 is not
     * divisible by 3, so the meter draws an even three-way split as 7/7/6
     * (35/35/30) while the server's no-parts path divides 20 by 3 exactly. The
     * user would confirm one allocation and the database would store another.
     */
    submission: (mealId: string, isSplit: boolean): ShareMealRequest => ({
      mealId,
      friendUserIds: seated.map((m) => m.profile.userId),
      mode: isSplit ? 'split' : 'copy',
      ...(isSplit
        ? {
            myParts: parts[0],
            splits: seated.map((m, i) => ({
              userId: m.profile.userId,
              parts: parts[i + 1],
            })),
          }
        : {}),
    }),
    /** My own run, in parts. A whole-portion share keeps the entire dish. */
    keptParts: (isSplit: boolean) =>
      isSplit && seated.length > 0 ? parts[0] : TOTAL_PARTS,
  };
}
