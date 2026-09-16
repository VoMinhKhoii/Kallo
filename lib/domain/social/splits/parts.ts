// ---------------------------------------------------------------------------
// Split parts — the arithmetic behind the portion battery
// ---------------------------------------------------------------------------
// A shared dish is TOTAL_PARTS units of 5% each, and every participant holds a
// contiguous run of them. Parts travel as INTEGERS: the client sends whole
// units, the server asserts they sum to exactly TOTAL_PARTS, and every factor
// is derived here. That is the whole reason this is integers and not floats —
// one equality check replaces "do these shares sum to 0.9999?".
//
// The twin of this file on mobile is
// `apps/mobile-flutter/lib/features/circle/logic/split_parts.dart`; the two
// must agree on TOTAL_PARTS, MIN_PARTS and MAX_PARTICIPANTS or a share built on
// one platform will be refused by the other.

import { Errors } from '@/lib/core/errors/catalog';

/** The dish, in units of 5%. */
export const TOTAL_PARTS = 20;

/** Nobody may hold less than this. 2 parts = 10%, which is also the narrowest
 *  run the control can draw a face over without the faces colliding. */
export const MIN_PARTS = 2;

/** Seats in the palette: you plus five friends. */
export const MAX_PARTICIPANTS = 6;

export interface SplitPart {
  userId: string;
  parts: number;
}

/**
 * An even split across [participants], as whole parts.
 *
 * TOTAL_PARTS is not divisible by 3 or 6, so the remainder is handed to the
 * earliest seats — an even three-way split is 7/7/6, which the UI shows
 * honestly as 35 / 35 / 30 rather than pretending to be thirds.
 */
export function evenParts(participants: number): number[] {
  if (
    !Number.isInteger(participants) ||
    participants < 2 ||
    participants > MAX_PARTICIPANTS
  ) {
    throw Errors.validationFailed(
      `Số người chia phải từ 2 đến ${MAX_PARTICIPANTS}.`
    );
  }
  const base = Math.floor(TOTAL_PARTS / participants);
  let remainder = TOTAL_PARTS - base * participants;
  return Array.from({ length: participants }, () => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return base + extra;
  });
}

/**
 * Validate a client-proposed split. Throws on the first violation.
 *
 * [myParts] is the sender's own run; [splits] is one entry per recipient. The
 * sender counts toward MAX_PARTICIPANTS, so five recipients is the ceiling.
 */
export function assertPartsValid(myParts: number, splits: SplitPart[]): void {
  const participants = splits.length + 1;
  if (participants < 2 || participants > MAX_PARTICIPANTS) {
    throw Errors.validationFailed(
      `Chỉ có thể chia phần với tối đa ${MAX_PARTICIPANTS - 1} người bạn.`
    );
  }

  const seen = new Set<string>();
  for (const split of splits) {
    if (seen.has(split.userId)) {
      throw Errors.validationFailed('Mỗi người chỉ nhận một phần.');
    }
    seen.add(split.userId);
  }

  const runs = [myParts, ...splits.map((s) => s.parts)];
  for (const parts of runs) {
    if (!Number.isInteger(parts)) {
      throw Errors.validationFailed('Phần chia phải là số nguyên.');
    }
    if (parts < MIN_PARTS) {
      throw Errors.validationFailed(
        `Mỗi người phải nhận ít nhất ${(MIN_PARTS / TOTAL_PARTS) * 100}% phần.`
      );
    }
  }

  const total = runs.reduce((a, b) => a + b, 0);
  if (total !== TOTAL_PARTS) {
    throw Errors.validationFailed('Tổng các phần phải bằng cả bữa ăn.');
  }
}

/**
 * What accept must scale the source meal by for this recipient.
 *
 * The sender's meal has ALREADY been scaled down to `myParts / TOTAL_PARTS` by
 * the time an invite exists, so accept copies from that reduced meal — which
 * makes the factor a ratio of the two runs, not a fraction of the dish. An even
 * split gives 1, which is exactly the verbatim copy the shipped code performs,
 * and is why the column can default to 1 with no backfill.
 */
export function copyFactorFor(recipientParts: number, myParts: number): number {
  if (myParts <= 0) {
    throw Errors.validationFailed('Phần của bạn phải lớn hơn 0.');
  }
  return recipientParts / myParts;
}

/**
 * Remove the participant at [index], returning their parts to the table.
 *
 * The freed parts spread across everyone left rather than going to one person,
 * and any remainder lands on the earliest seat, so the result still sums to
 * TOTAL_PARTS exactly. Mirrors `partsAfterRemoval` in `split_parts.dart`.
 */
export function partsAfterRemoval(parts: number[], index: number): number[] {
  const freed = parts[index];
  const next = parts.filter((_, i) => i !== index);
  const share = Math.floor(freed / next.length);
  let remainder = freed - share * next.length;
  return next.map((p) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return p + share + extra;
  });
}

/**
 * Seat one more person, taking their floor from whoever can most afford it.
 *
 * Taking from the largest run rather than resetting means adding a person never
 * silently discards a split somebody set by hand. Mirrors `partsAfterAdd` in
 * `split_parts.dart`.
 */
export function partsAfterAdd(parts: number[]): number[] {
  const next = [...parts];
  let owed = MIN_PARTS;
  while (owed > 0) {
    let largest = 0;
    for (let i = 1; i < next.length; i++) {
      if (next[i] > next[largest]) largest = i;
    }
    // Everyone is already at the floor: the table is full in practice and the
    // caller should have refused before reaching here.
    if (next[largest] <= MIN_PARTS) break;
    next[largest] -= 1;
    owed -= 1;
  }
  next.push(MIN_PARTS - owed);
  return next;
}

/**
 * Move a boundary, clamped so the meter can never produce a split the server
 * would refuse.
 *
 * Two clauses, and together they make overlap impossible by construction:
 *   1. A notch never passes its neighbours — crossing one would mean somebody
 *      owns a negative run.
 *   2. A notch stops MIN_PARTS short of each, so no run is ever narrower than
 *      the pin sitting on it.
 *
 * Only the two runs the boundary sits between change; everyone else is left
 * alone, which is what keeps one drag from quietly restating another person's
 * share. Mirrors `partsAfterDrag` in `split_parts.dart`.
 */
export function partsAfterDrag(
  parts: number[],
  boundary: number,
  desiredLeftEnd: number
): number[] {
  const before = parts.slice(0, boundary).reduce((a, b) => a + b, 0);
  const pairTotal = parts[boundary] + parts[boundary + 1];
  const leftEnd = Math.min(
    Math.max(desiredLeftEnd, before + MIN_PARTS),
    before + pairTotal - MIN_PARTS
  );
  const next = [...parts];
  next[boundary] = leftEnd - before;
  next[boundary + 1] = pairTotal - next[boundary];
  return next;
}

/** Everything the persistence layer needs to write one share. */
export interface ShareAllocation {
  /** The sender's own share of the original dish. 1 for a whole-portion send. */
  senderFactor: number;
  /** Per recipient, keyed by user id. */
  recipients: Map<string, { portionFactor: number; copyFactor: number }>;
}

/**
 * Turn a validated request into the factors the rows actually store.
 *
 * This is the whole "how does this dish divide" question, answered once and in
 * the domain layer. It lived inside the share transaction, where it needed four
 * casts and a closure to express, and where it was easy to mistake one factor
 * for the other — `portionFactor` (share of the ORIGINAL dish, for the inbox
 * label) and `copyFactor` (run ÷ the sender's REMAINING run, what accept
 * multiplies by) are equal for an even split and diverge for an uneven one.
 *
 * [recipientIds] is the POST-dedup, post-drop-self set. Passing the raw request
 * ids instead is how parts for a non-recipient get silently discarded, leaving
 * the sender scaled by a share of a dish that never fully adds up.
 */
export function resolveShareAllocation(input: {
  mode: 'copy' | 'split';
  recipientIds: string[];
  myParts?: number;
  splits?: SplitPart[];
}): ShareAllocation {
  const { mode, recipientIds } = input;

  if (mode === 'copy') {
    return {
      senderFactor: 1,
      recipients: new Map(
        recipientIds.map((id) => [id, { portionFactor: 1, copyFactor: 1 }])
      ),
    };
  }

  const uneven = input.splits != null && input.myParts != null;
  if (uneven) {
    const splits = input.splits as SplitPart[];
    const recipientSet = new Set(recipientIds);
    const covers =
      splits.length === recipientIds.length &&
      splits.every((s) => recipientSet.has(s.userId));
    if (!covers) {
      throw Errors.validationFailed(
        'Tỉ lệ phải khớp với những người được chọn.'
      );
    }
    assertPartsValid(input.myParts as number, splits);
  }

  const myParts = uneven
    ? (input.myParts as number)
    : TOTAL_PARTS / (recipientIds.length + 1);
  const partsFor = (id: string) =>
    uneven
      ? ((input.splits as SplitPart[]).find((s) => s.userId === id)
          ?.parts as number)
      : myParts;

  return {
    senderFactor: myParts / TOTAL_PARTS,
    recipients: new Map(
      recipientIds.map((id) => [
        id,
        {
          portionFactor: partsFor(id) / TOTAL_PARTS,
          copyFactor: copyFactorFor(partsFor(id), myParts),
        },
      ])
    ),
  };
}
