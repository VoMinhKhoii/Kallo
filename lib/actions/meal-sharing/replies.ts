'use server';

// ---------------------------------------------------------------------------
// Meal-share reply create
// ---------------------------------------------------------------------------

import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { Errors } from '@/lib/core/errors/catalog';
import { shareReplyKey } from '@/lib/domain/notifications/group-keys';
import { withNotifications } from '@/lib/domain/notifications/with-notifications';
import {
  publicProfileColumns,
  toPublicIdentity,
} from '@/lib/domain/social/identity/public-identity';
import type { ShareReply } from '@/lib/domain/social/shares/replies';
import { canViewShareOwnedBy } from '@/lib/domain/social/shares/share-visibility';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import { db } from '@/lib/infra/db/client';
import {
  mealShareReplies,
  mealShares,
  publicProfiles,
} from '@/lib/infra/db/schema';

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

  return withNotifications(db, async (tx, notify) => {
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

    // Only a reply this call actually CREATED is new activity. A retry of the
    // same replyId took the conflict branch and loaded the row the first
    // attempt already wrote — and already notified for — so re-notifying here
    // would refresh the aggregate a second time and republish the preview.
    // Worse, `parsed.body` on a retry need not equal what was persisted, so
    // the preview would rewrite history; the persisted `reply.body` is the
    // only authoritative text. `pushRecipients` stays empty on that path.
    // Hydrated before the fan-out, not after it: the optimistic append needs
    // this identity anyway, and reading it first lets the push reuse the name
    // instead of making push.ts re-read the profile post-commit.
    const [author] = await tx
      .select({
        userId: publicProfiles.userId,
        ...publicProfileColumns,
      })
      .from(publicProfiles)
      .where(eq(publicProfiles.userId, user.id))
      .limit(1);

    if (inserted) {
      // Thread audience: the meal's owner plus everyone who already replied
      // (the insert above is included, hence the author filter). One aggregated
      // row per recipient per share — "X and 2 others replied".
      // Prior repliers are re-gated on their CURRENT visibility: notification
      // content (previewBody) must never outlive the access it rode in on, so
      // an unfriended replier drops out of the audience. The owner always sees
      // their own share and skips the check.
      const repliers = await tx
        .selectDistinct({ userId: mealShareReplies.userId })
        .from(mealShareReplies)
        .where(eq(mealShareReplies.shareId, parsed.shareId));
      const candidateIds = [
        ...new Set(repliers.map((row) => row.userId)),
      ].filter((id) => id !== user.id && id !== lockedShares[0].actorId);
      const visible = await Promise.all(
        candidateIds.map((candidateId) =>
          canViewShareOwnedBy(candidateId, lockedShares[0], tx)
        )
      );
      const visibleReplierIds = candidateIds.filter(
        (_, index) => visible[index]
      );
      const recipientIds = [
        lockedShares[0].actorId,
        ...visibleReplierIds,
      ].filter((id) => id !== user.id);
      await notify(
        recipientIds.map((recipientId) => ({
          recipientId,
          type: 'share.reply' as const,
          actorId: user.id,
          objectType: 'share',
          objectId: parsed.shareId,
          groupKey: shareReplyKey(parsed.shareId),
          data: { previewBody: reply.body.slice(0, 140) },
        })),
        {
          actorName: author?.displayName?.trim() || author?.handle || undefined,
        }
      );
    }

    return {
      id: reply.id,
      author: toPublicIdentity({
        userId: author?.userId ?? user.id,
        handle: author?.handle ?? '',
        displayName: author?.displayName ?? null,
        avatarSeed: author?.avatarSeed ?? null,
        avatarUrl: author?.avatarUrl ?? null,
        avatarPath: author?.avatarPath ?? null,
      }),
      isSelf: true,
      body: reply.body,
      createdAt: reply.createdAt.toISOString(),
    };
  });
}
