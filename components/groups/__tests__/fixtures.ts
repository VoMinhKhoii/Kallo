// The Circle's shared test data. A shared meal entry is the one record the
// feed row, the post's own page and the thread under it all draw, so a fixture
// per suite meant three transcriptions of the same shape drifting apart. Build
// the canonical one here and override only the field a test is actually about.

import type { SharedMealEntry } from '@/lib/domain/social/feed/meal-feed';
import type { PublicIdentity } from '@/lib/domain/social/identity/public-identity';
import type { ShareReply } from '@/lib/domain/social/shares/replies';

/** A real uuid: the thread page validates the id before it reads anything, so
 * a `'share-1'` placeholder would be a share that cannot exist. */
export const SHARE_ID = '3f1d2c4b-5a6e-4f70-8b91-0c2d3e4f5a6b';

/** The other person in every Circle fixture — the post's author, and the voice
 * of any reply that is not yours. */
export const FRIEND: PublicIdentity = {
  userId: 'u2',
  handle: 'phofan',
  displayName: 'Phở Fan',
  avatarSeed: null,
  avatarUrl: null,
  hasCustomAvatar: false,
};

/** One reply under a post, from the friend who owns it. */
export function shareReplyFixture(
  overrides: Partial<ShareReply> = {}
): ShareReply {
  return {
    id: 'reply-1',
    author: FRIEND,
    isSelf: false,
    body: 'looks great',
    createdAt: '2026-05-03T08:05:00.000Z',
    ...overrides,
  };
}

/** A friend's shared meal, unreacted and unanswered — the quiet default every
 * suite starts from. */
export function sharedMealEntryFixture(
  overrides: Partial<SharedMealEntry> = {}
): SharedMealEntry {
  return {
    friend: FRIEND,
    isSelf: false,
    meal: {
      mealId: 'meal-1',
      shareId: SHARE_ID,
      rawInput: 'bún chả',
      caloriesKcal: 420,
      proteinG: 38,
      carbohydrateG: 64,
      fatG: 12,
      portionFactor: 1,
      sharedAt: '2026-05-03T08:00:00.000Z',
      isBackfilled: false,
    },
    reactions: { count: 0, mine: false },
    replies: [],
    repliesTotal: 0,
    ...overrides,
  };
}
