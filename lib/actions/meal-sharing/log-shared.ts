'use server';

// ---------------------------------------------------------------------------
// Recipient-initiated shared-meal copy
// ---------------------------------------------------------------------------

import { and, eq, getTableColumns, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { copyMealVerbatim } from '@/lib/actions/meals/copy-meal-verbatim';
import type { ConfirmMealResponse } from '@/lib/actions/meals/types';
import { requireAuthAndProfile } from '@/lib/auth';
import { getUtcInstantForLocalDate } from '@/lib/date/local-day';
import { db } from '@/lib/db';
import { mealItems, mealShares, meals } from '@/lib/db/schema';
import { Errors } from '@/lib/errors';
import { canViewShare } from '@/lib/groups/share-visibility';
import { dateStringSchema, timezoneOffsetSchema } from '@/lib/validation';

const logSharedMealSchema = z.object({
  shareId: z.string().uuid('shareId phải là UUID hợp lệ.').toLowerCase(),
  factor: z.union([z.literal(1), z.literal(0.5)]),
  loggedDate: dateStringSchema,
  timezoneOffset: timezoneOffsetSchema,
  newMealId: z
    .string()
    .uuid('newMealId phải là UUID hợp lệ.')
    .toLowerCase()
    .optional(),
});

/**
 * Copy a visible shared meal into the actor's diary without touching its
 * owner. The source meal is row-locked before item reads so split/edit cannot
 * interleave different portion states; cheat and item-less sources are refused
 * because they cannot be reproduced as a precise stored-item copy.
 */
export async function logSharedMealAction(input: {
  shareId: string;
  factor: 1 | 0.5;
  loggedDate: string;
  timezoneOffset: number;
  newMealId?: string;
}): Promise<ConfirmMealResponse> {
  const parsed = logSharedMealSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  return db.transaction(async (tx) => {
    if (!(await canViewShare(user.id, parsed.shareId, tx))) {
      throw Errors.notFound('Không tìm thấy bài chia sẻ.');
    }

    const [source] = await tx
      .select(getTableColumns(meals))
      .from(meals)
      .innerJoin(mealShares, eq(mealShares.mealId, meals.id))
      .where(
        and(
          eq(mealShares.id, parsed.shareId),
          or(
            eq(meals.userId, user.id),
            sql`${mealShares.visibility} <> 'private'`
          )
        )
      )
      .limit(1)
      .for('update');
    if (!source) {
      throw Errors.notFound('Bữa ăn không còn tồn tại.');
    }
    if (source.entryMode === 'cheat') {
      throw Errors.validationFailed('Không thể ăn theo bữa xả.');
    }

    const sourceItems = await tx
      .select()
      .from(mealItems)
      .where(eq(mealItems.mealId, source.id));
    if (sourceItems.length === 0) {
      throw Errors.validationFailed('Bữa ăn này không có món để thêm.');
    }

    const loggedAt = getUtcInstantForLocalDate(
      parsed.loggedDate,
      parsed.timezoneOffset
    );
    return copyMealVerbatim(tx, source, sourceItems, {
      userId: user.id,
      newMealId: parsed.newMealId,
      loggedAt,
      factor: parsed.factor,
    });
  });
}
