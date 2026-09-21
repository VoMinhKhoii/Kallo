'use server';

import { and, desc, eq, or } from 'drizzle-orm';
import { avatarUrlFor } from '@/lib/domain/social/identity/avatar-url';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import { db } from '@/lib/infra/db/client';
import {
  friendships,
  mealShareInvites,
  meals,
  publicProfiles,
} from '@/lib/infra/db/schema';
import type { MealShareInvite } from './types';

export async function listMealShareInvitesAction(): Promise<MealShareInvite[]> {
  const { user } = await requireAuthAndProfile();

  const rows = await db
    .select({
      id: mealShareInvites.id,
      mode: mealShareInvites.mode,
      portionFactor: mealShareInvites.portionFactor,
      createdAt: mealShareInvites.createdAt,
      fromUserId: mealShareInvites.fromUserId,
      copyFactor: mealShareInvites.copyFactor,
      rawInput: meals.rawInput,
      caloriesKcal: meals.caloriesKcal,
      proteinG: meals.proteinG,
      carbohydrateG: meals.carbohydrateG,
      fatG: meals.fatG,
      entryMode: meals.entryMode,
      handle: publicProfiles.handle,
      displayName: publicProfiles.displayName,
      avatarSeed: publicProfiles.avatarSeed,
      avatarUrl: publicProfiles.avatarUrl,
      avatarPath: publicProfiles.avatarPath,
    })
    .from(mealShareInvites)
    .innerJoin(
      meals,
      and(
        eq(meals.id, mealShareInvites.sourceMealId),
        eq(meals.userId, mealShareInvites.fromUserId)
      )
    )
    .innerJoin(
      publicProfiles,
      eq(publicProfiles.userId, mealShareInvites.fromUserId)
    )
    .innerJoin(
      friendships,
      and(
        eq(friendships.status, 'accepted'),
        or(
          and(
            eq(friendships.userLow, user.id),
            eq(friendships.userHigh, mealShareInvites.fromUserId)
          ),
          and(
            eq(friendships.userHigh, user.id),
            eq(friendships.userLow, mealShareInvites.fromUserId)
          )
        )
      )
    )
    .where(
      and(
        eq(mealShareInvites.toUserId, user.id),
        eq(mealShareInvites.status, 'pending')
      )
    )
    .orderBy(desc(mealShareInvites.createdAt));

  return rows.map((row) => {
    // The joined meal is the SENDER's row, which a split already scaled down to
    // THEIR share. `copy_factor` is what accept will multiply it by, so it is
    // also what turns those numbers into the offer being made to this reader.
    //
    // Without it an uneven split shows the sender's 650 kcal beside the
    // reader's own "35%", and accepting then writes 350 — the card would be
    // advertising a portion nobody is being offered. An even split has a factor
    // of 1, so this is a no-op for every pre-existing row.
    const factor = Number(row.copyFactor);
    const scale = Number.isFinite(factor) && factor > 0 ? factor : 1;
    const times = (v: number | null) => (v == null ? null : v * scale);
    return {
      id: row.id,
      mode: row.mode === 'split' ? 'split' : 'copy',
      portionFactor: Number(row.portionFactor) || 1,
      createdAt: row.createdAt.toISOString(),
      from: {
        userId: row.fromUserId,
        handle: row.handle,
        displayName: row.displayName,
        avatarSeed: row.avatarSeed,
        // Uploaded photo takes precedence over the synced OAuth picture.
        avatarUrl: avatarUrlFor(row.avatarPath) ?? row.avatarUrl,
      },
      meal: {
        rawInput: row.rawInput,
        caloriesKcal: times(row.caloriesKcal),
        proteinG: times(row.proteinG),
        carbohydrateG: times(row.carbohydrateG),
        fatG: times(row.fatG),
        // Decides which action the card offers: a precise invite is accepted
        // outright, a cheat one reopens the sender's sliders so the reader can
        // set their own amounts. Also what lets the card show the cheat
        // paywall BEFORE the tap spends the offer.
        entryMode: row.entryMode === 'cheat' ? 'cheat' : 'precise',
      },
    };
  });
}
