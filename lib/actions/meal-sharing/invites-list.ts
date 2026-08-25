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
      rawInput: meals.rawInput,
      caloriesKcal: meals.caloriesKcal,
      proteinG: meals.proteinG,
      carbohydrateG: meals.carbohydrateG,
      fatG: meals.fatG,
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

  return rows.map((row) => ({
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
      caloriesKcal: row.caloriesKcal,
      proteinG: row.proteinG,
      carbohydrateG: row.carbohydrateG,
      fatG: row.fatG,
    },
  }));
}
