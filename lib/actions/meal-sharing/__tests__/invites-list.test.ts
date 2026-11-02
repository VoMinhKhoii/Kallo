import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSelect } = vi.hoisted(() => ({ mockSelect: vi.fn() }));
vi.mock('@/lib/infra/db/client', () => ({ db: { select: mockSelect } }));
vi.mock('@/lib/infra/auth/session', () => ({
  requireAuthAndProfile: vi.fn().mockResolvedValue({
    user: { id: '9d1f2c44-7b3e-4a55-9c22-1aa2bb334455' },
  }),
}));
vi.mock('@/lib/infra/storage/object-storage', () => ({
  storageReadsAllowed: () => true,
}));

import { listMealShareInvitesAction } from '@/lib/actions/meal-sharing/invites-list';
import {
  GOOGLE_PICTURE,
  HOSTILE_AVATAR_URLS,
  OWN_AVATAR_BASE,
} from '@/lib/domain/social/identity/__tests__/hostile-avatar-urls';

const SENDER = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';

function inviteRow(avatar: {
  avatarUrl: string | null;
  avatarPath: string | null;
}) {
  return {
    id: 'e4ccff33-d04f-4cc2-af01-affdf0724e55',
    mode: 'copy',
    portionFactor: '1',
    createdAt: new Date('2026-04-05T17:30:00.000Z'),
    fromUserId: SENDER,
    copyFactor: '1',
    rawInput: 'phở bò',
    caloriesKcal: 450,
    proteinG: 25,
    carbohydrateG: 60,
    fatG: 10,
    entryMode: 'precise',
    handle: 'mai',
    displayName: 'Mai',
    avatarSeed: 'mai',
    ...avatar,
  };
}

/** `.from().innerJoin()×3.where().orderBy()` resolving to the given rows. */
function selectRows(rows: unknown[]) {
  const query = {
    from: () => query,
    innerJoin: () => query,
    where: () => query,
    orderBy: () => Promise.resolve(rows),
  };
  mockSelect.mockReturnValueOnce(query);
}

async function senderAvatar(avatar: {
  avatarUrl: string | null;
  avatarPath: string | null;
}) {
  selectRows([inviteRow(avatar)]);
  const [invite] = await listMealShareInvitesAction();
  return invite.from.avatarUrl;
}

describe('listMealShareInvitesAction sender avatar', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_AVATAR_BASE_URL', OWN_AVATAR_BASE);
  });

  it('prefers the uploaded photo, else the Google picture', async () => {
    await expect(
      senderAvatar({
        avatarUrl: GOOGLE_PICTURE,
        avatarPath: `${SENDER}/a.webp`,
      })
    ).resolves.toBe(`${OWN_AVATAR_BASE}/${SENDER}/a.webp`);
    await expect(
      senderAvatar({ avatarUrl: GOOGLE_PICTURE, avatarPath: null })
    ).resolves.toBe(GOOGLE_PICTURE);
  });

  it.each(
    Object.entries(HOSTILE_AVATAR_URLS)
  )('drops a stored OAuth picture with %s', async (_, url) => {
    await expect(
      senderAvatar({ avatarUrl: url, avatarPath: null })
    ).resolves.toBeNull();
  });
});
