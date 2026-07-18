'use server';

// ---------------------------------------------------------------------------
// Meal-share reply create
// ---------------------------------------------------------------------------

import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuthAndProfile } from '@/lib/auth';
import { db } from '@/lib/db';
import { mealShareReplies, mealShares, publicProfiles } from '@/lib/db/schema';
import { Errors } from '@/lib/errors';
import {
  publicProfileColumns,
  toPublicIdentity,
} from '@/lib/groups/public-identity';
import { canViewShareOwnedBy } from '@/lib/groups/share-visibility';
import type { ShareReply } from '@/lib/groups/shares/replies';

const createShareReplySchema = z.object({
  shareId: z.string().uuid('shareId phải là UUID hợp lệ.').toLowerCase(),
  replyId: z
    .string()
    .uuid('replyId phải là UUID hợp lệ.')
    .toLowerCase()
    .optional(),
  body: z
    .string()
    .trim()
    .min(1, 'Nội dung trả lời không được để trống.')
    .max(500, 'Nội dung trả lời tối đa 500 ký tự.'),
});

/**
 * Post a reply to a share. canViewShare is the sole tenant boundary (Drizzle
 * bypasses RLS), mirroring toggleShareReactionAction — you may reply to any
 * meal you can see (owner, accepted friend, or co-member of a group with the
 * owner). Returns the enriched reply so the client can append it optimistically.
 */
export async function createShareReplyAction(input: {
  shareId: string;
  replyId?: string;
  body: string;
}): Promise<ShareReply> {
  const parsed = createShareReplySchema.parse(input);
  const { user } = await requireAuthAndProfile();

  return db.transaction(async (tx) => {
    const lockedShares = await tx
      .select({
        id: mealShares.id,
        actorId: mealShares.actorId,
        sharedAt: mealShares.sharedAt,
        visibility: mealShares.visibility,
      })
      .from(mealShares)
      .where(eq(mealShares.id, parsed.shareId))
      .for('update');
    if (lockedShares.length === 0) {
      throw Errors.notFound('Không tìm thấy bài chia sẻ.');
    }
    if (!(await canViewShareOwnedBy(user.id, lockedShares[0], tx))) {
      throw Errors.notFound('Không tìm thấy bài chia sẻ.');
    }

    const [inserted] = await tx
      .insert(mealShareReplies)
      .values({
        id: parsed.replyId ?? undefined,
        shareId: parsed.shareId,
        userId: user.id,
        body: parsed.body,
      })
      .onConflictDoNothing({ target: mealShareReplies.id })
      .returning({
        id: mealShareReplies.id,
        userId: mealShareReplies.userId,
        body: mealShareReplies.body,
        createdAt: mealShareReplies.createdAt,
      });

    let reply = inserted;
    if (!reply && parsed.replyId) {
      [reply] = await tx
        .select({
          id: mealShareReplies.id,
          userId: mealShareReplies.userId,
          body: mealShareReplies.body,
          createdAt: mealShareReplies.createdAt,
        })
        .from(mealShareReplies)
        .where(
          and(
            eq(mealShareReplies.id, parsed.replyId),
            eq(mealShareReplies.userId, user.id)
          )
        )
        .limit(1);
    }
    if (!reply || reply.userId !== user.id) {
      throw Errors.validationFailed('Mã trả lời đã được sử dụng.');
    }

    const [author] = await tx
      .select({
        userId: publicProfiles.userId,
        ...publicProfileColumns,
      })
      .from(publicProfiles)
      .where(eq(publicProfiles.userId, user.id))
      .limit(1);

    return {
      id: reply.id,
      author: toPublicIdentity({
        userId: author?.userId ?? user.id,
        handle: author?.handle ?? '',
        displayName: author?.displayName ?? null,
        avatarSeed: author?.avatarSeed ?? null,
        avatarUrl: author?.avatarUrl ?? null,
      }),
      isSelf: true,
      body: reply.body,
      createdAt: reply.createdAt.toISOString(),
    };
  });
}
