import { describe, expect, it } from 'vitest';
import {
  type CapturedQuery,
  compileWhere,
  createExportDb,
} from '@/lib/domain/account-export/__fixtures__/export-db';
import {
  buildDataExport,
  DATA_EXPORT_FORMAT_VERSION,
} from '@/lib/domain/account-export/build-export';

const USER = '11111111-1111-4111-8111-111111111111';
const FRIEND = '22222222-2222-4222-8222-222222222222';
const at = new Date('2026-09-01T08:00:00.000Z');

const user = {
  id: USER,
  email: 'owner@kallo.fit',
  created_at: '2026-01-02T03:04:05.000Z',
  last_sign_in_at: '2026-09-20T10:00:00.000Z',
  app_metadata: { providers: ['email', 'google', 42], role: 'admin' },
  user_metadata: {
    display_name: 'Khoa',
    full_name: 'Khoa Pham',
    avatar_url: 'https://lh3.googleusercontent.com/a/photo',
    email_verified: true,
    // Not on the allowlist: credential-like, unknown, or not a scalar.
    provider_token: 'ya29.secret',
    provider_refresh_token: 'refresh-secret',
    custom_claims: { hd: 'kallo.fit' },
    iss: 'https://accounts.google.com',
  },
  identities: [
    {
      id: '109876543210',
      identity_id: '33333333-3333-4333-8333-333333333333',
      user_id: USER,
      provider: 'google',
      identity_data: {
        sub: '109876543210',
        email: 'owner@kallo.fit',
        name: 'Khoa Pham',
        picture: 'https://lh3.googleusercontent.com/a/photo',
        access_token: 'ya29.secret',
        id_token: 'eyJ.secret',
        aud: 'client-id',
      },
      created_at: '2026-01-02T03:04:05.000Z',
      last_sign_in_at: '2026-09-20T10:00:00.000Z',
      updated_at: '2026-09-20T10:00:00.000Z',
    },
  ],
};

const key = (query: CapturedQuery) => [query.from, ...query.joins].join(' ⋈ ');

/**
 * The WHERE every export query must carry, by table (and join). Pinned as SQL
 * text so a builder that drops or widens its user predicate — the one control
 * that keeps another person's rows out of this download — fails here.
 */
const EXPECTED_SCOPE: Record<string, string> = {
  user_profiles: '"user_profiles"."user_id" = $1',
  public_profiles: '"public_profiles"."user_id" = $1',
  meals: '"meals"."user_id" = $1',
  'meal_items ⋈ meals': '"meals"."user_id" = $1',
  body_weight_log: '"body_weight_log"."user_id" = $1',
  day_completion_marks: '"day_completion_marks"."user_id" = $1',
  nutrition_label_images: '"nutrition_label_images"."user_id" = $1',
  'friendships ⋈ public_profiles':
    '(("friendships"."user_low" = $1 or "friendships"."user_high" = $2) and "friendships"."status" <> $3)',
  meal_shares: '"meal_shares"."actor_id" = $1',
  meal_share_reactions: '"meal_share_reactions"."user_id" = $1',
  meal_share_replies: '"meal_share_replies"."user_id" = $1',
  meal_share_invites:
    '("meal_share_invites"."from_user_id" = $1 or "meal_share_invites"."to_user_id" = $2)',
  circle_events: '"circle_events"."actor_id" = $1',
  friends_feed_read_markers: '"friends_feed_read_markers"."user_id" = $1',
  coach_assignments:
    '("coach_assignments"."coach_id" = $1 or "coach_assignments"."client_id" = $2)',
  'chat_group_members ⋈ chat_groups': '"chat_group_members"."user_id" = $1',
  chat_groups: '"chat_groups"."created_by" = $1',
  'chat_group_members ⋈ my_membership': '"my_membership"."user_id" = $1',
  chat_group_messages: '"chat_group_messages"."sender_id" = $1',
  notifications: '"notifications"."recipient_id" = $1',
  push_tokens: '"push_tokens"."user_id" = $1',
  user_feedback: '"user_feedback"."user_id" = $1',
  entitlement_grants: '"entitlement_grants"."user_id" = $1',
  billing_provider_syncs: '"billing_provider_syncs"."user_id" = $1',
  pipeline_requests: '"pipeline_requests"."user_id" = $1',
  pending_analyses: '"pending_analyses"."user_id" = $1',
  unmatched_ingredients: '"unmatched_ingredients"."user_id" = $1',
  product_telemetry_events: '"product_telemetry_events"."user_id" = $1',
};

describe('buildDataExport — scoping', () => {
  it('scopes every query to the caller and nothing else', async () => {
    const { db, queries } = createExportDb();
    await buildDataExport(db, user);

    expect(queries.map(key).sort()).toEqual(Object.keys(EXPECTED_SCOPE).sort());
    for (const query of queries) {
      const compiled = compileWhere(query);
      expect(compiled?.sql, key(query)).toBe(EXPECTED_SCOPE[key(query)]);
      // The only bound values are the caller's id (and the literal status
      // the friendship read filters out).
      for (const param of compiled?.params ?? []) {
        expect([USER, 'blocked'], key(query)).toContain(param);
      }
    }
  });
});

describe('buildDataExport — contents', () => {
  it('keeps the original six keys and adds the new categories', async () => {
    const { db } = createExportDb();
    const document = await buildDataExport(db, user);

    expect(Object.keys(document)).toEqual(
      expect.arrayContaining([
        'exportedAt',
        'account',
        'profile',
        'meals',
        'weights',
        'billingGrants',
        'circleProfile',
        'dayCompletionMarks',
        'labelScans',
        'social',
        'chat',
        'notifications',
        'pushDevices',
        'support',
        'billingSyncs',
        'analysis',
        'telemetry',
        'files',
      ])
    );
    expect(document.formatVersion).toBe(DATA_EXPORT_FORMAT_VERSION);
    expect(document.account).toEqual({
      id: USER,
      email: 'owner@kallo.fit',
      createdAt: '2026-01-02T03:04:05.000Z',
      lastSignInAt: '2026-09-20T10:00:00.000Z',
      signInProviders: ['email', 'google'],
      profileClaims: {
        display_name: 'Khoa',
        full_name: 'Khoa Pham',
        avatar_url: 'https://lh3.googleusercontent.com/a/photo',
        email_verified: true,
      },
      identities: [
        {
          provider: 'google',
          identityId: '33333333-3333-4333-8333-333333333333',
          providerUserId: '109876543210',
          createdAt: '2026-01-02T03:04:05.000Z',
          lastSignInAt: '2026-09-20T10:00:00.000Z',
          updatedAt: '2026-09-20T10:00:00.000Z',
          claims: {
            sub: '109876543210',
            email: 'owner@kallo.fit',
            name: 'Khoa Pham',
            picture: 'https://lh3.googleusercontent.com/a/photo',
          },
        },
      ],
    });
    // Belt and braces: no credential or app_metadata value anywhere in the file.
    const serialized = JSON.stringify(document);
    for (const secret of ['secret', 'admin', 'client-id', 'accounts.google']) {
      expect(serialized).not.toContain(secret);
    }
    expect(document.profile).toHaveProperty('autoShareToCircle', true);
    expect(document.meals[0]?.items).toHaveLength(1);
    expect(document.social.reactions).toHaveLength(1);
    expect(document.social.replies[0]).toHaveProperty('body');
    expect(document.social.circleEvents).toHaveLength(1);
    expect(document.chat.messagesSent[0]).toHaveProperty('body');
    expect(document.notifications[0]).not.toHaveProperty('rebadged');
    expect(document.support.feedback[0]).toHaveProperty('screenshotPath');
    expect(document.analysis.requests[0]).not.toHaveProperty('error');
    expect(document.telemetry).toHaveLength(1);
  });

  it('describes a friendship from the caller’s side with only the friend’s handle', async () => {
    const { db } = createExportDb((query) =>
      query.from === 'friendships'
        ? [
            {
              id: 'f-1',
              friendUserId: FRIEND,
              friendHandle: 'phofan',
              status: 'accepted',
              requestedBy: FRIEND,
              createdAt: at,
              updatedAt: at,
            },
          ]
        : undefined
    );
    const { social } = await buildDataExport(db, user);

    expect(social.friendships).toEqual([
      {
        id: 'f-1',
        friendUserId: FRIEND,
        friendHandle: 'phofan',
        status: 'accepted',
        requestedByMe: false,
        createdAt: at,
        updatedAt: at,
      },
    ]);
  });

  it('labels share invites by direction without leaking the recipient’s meal', async () => {
    const invite = {
      sourceMealId: 'meal-src',
      mode: 'split',
      portionFactor: '0.5',
      copyFactor: 1,
      status: 'accepted',
      acceptedMealId: 'meal-copy',
      createdAt: at,
      respondedAt: at,
    };
    const { db } = createExportDb((query) =>
      query.from === 'meal_share_invites'
        ? [
            { ...invite, id: 'sent', fromUserId: USER, toUserId: FRIEND },
            { ...invite, id: 'got', fromUserId: FRIEND, toUserId: USER },
          ]
        : undefined
    );
    const { social } = await buildDataExport(db, user);

    expect(social.mealShareInvites).toMatchObject([
      {
        id: 'sent',
        direction: 'sent',
        counterpartUserId: FRIEND,
        acceptedMealId: null,
      },
      {
        id: 'got',
        direction: 'received',
        counterpartUserId: FRIEND,
        acceptedMealId: 'meal-copy',
      },
    ]);
  });

  it('lists chats the caller is in or created, with rosters but no one else’s messages', async () => {
    const group = {
      kind: 'group',
      name: 'Lunch',
      createdBy: USER,
      directUserLow: null,
      directUserHigh: null,
      avatarSeed: null,
      createdAt: at,
      updatedAt: at,
    };
    const { db, queries } = createExportDb((query) => {
      if (query.from === 'chat_groups') {
        // Created by the caller; one of them they have since left.
        return [
          { ...group, id: 'g-in' },
          { ...group, id: 'g-left' },
        ];
      }
      if (query.from !== 'chat_group_members') return undefined;
      return query.joins.includes('chat_groups')
        ? [
            {
              group: { ...group, id: 'g-in' },
              role: 'owner',
              joinedAt: at,
              lastReadAt: at,
            },
          ]
        : [
            { groupId: 'g-in', userId: USER },
            { groupId: 'g-in', userId: FRIEND },
          ];
    });
    const { chat } = await buildDataExport(db, user);

    expect(chat.groups).toMatchObject([
      { id: 'g-in', myRole: 'owner', memberUserIds: [USER, FRIEND] },
      { id: 'g-left', myRole: null, createdByMe: true, memberUserIds: [] },
    ]);
    const messageQuery = queries.find((q) => q.from === 'chat_group_messages');
    expect(compileWhere(messageQuery as CapturedQuery)?.sql).toContain(
      '"sender_id"'
    );
  });

  it('redacts push tokens to a short tail', async () => {
    const { db } = createExportDb((query) =>
      query.from === 'push_tokens'
        ? [
            {
              id: 'd-1',
              token: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
              platform: 'ios',
              lastSeenAt: at,
              createdAt: at,
            },
          ]
        : undefined
    );
    const { pushDevices } = await buildDataExport(db, user);

    expect(pushDevices).toEqual([
      {
        id: 'd-1',
        platform: 'ios',
        tokenHint: '…7e8f90',
        lastSeenAt: at,
        createdAt: at,
      },
    ]);
    expect(JSON.stringify(pushDevices)).not.toContain('a1b2c3d4');
  });

  it('lists stored files as bucket + path, never bytes', async () => {
    const { db } = createExportDb((query) => {
      if (query.from === 'public_profiles') {
        return [
          {
            userId: USER,
            handle: 'me',
            displayName: null,
            avatarSeed: null,
            avatarUrl: null,
            avatarPath: `${USER}/avatar.webp`,
            createdAt: at,
            updatedAt: at,
          },
        ];
      }
      if (query.from === 'user_feedback') {
        return [
          { id: 'fb-1', screenshotPath: `${USER}/shot.png` },
          { id: 'fb-2', screenshotPath: null },
        ];
      }
      if (query.from === 'nutrition_label_images') {
        return [
          {
            id: 'scan-1',
            storagePath: `${USER}/scan-1.jpg`,
            status: 'succeeded',
            mealId: null,
            createdAt: at,
          },
        ];
      }
      return undefined;
    });
    const { files, circleProfile, labelScans } = await buildDataExport(
      db,
      user
    );

    // The scan keeps its metadata; its photo is only listed under `files`.
    expect(labelScans).toEqual([
      { id: 'scan-1', status: 'succeeded', mealId: null, createdAt: at },
    ]);

    expect(circleProfile).not.toHaveProperty('userId');
    expect(files).toEqual([
      {
        bucket: 'avatars',
        path: `${USER}/avatar.webp`,
        source: 'circleProfile',
        sourceId: null,
      },
      {
        bucket: 'feedback-screenshots',
        path: `${USER}/shot.png`,
        source: 'feedback',
        sourceId: 'fb-1',
      },
      {
        bucket: 'nutrition-labels',
        path: `${USER}/scan-1.jpg`,
        source: 'labelScan',
        sourceId: 'scan-1',
      },
    ]);
  });

  it('returns empty sections, not errors, for a brand-new account', async () => {
    const { db } = createExportDb(() => []);
    const document = await buildDataExport(db, { id: USER });

    expect(document.profile).toBeNull();
    expect(document.circleProfile).toBeNull();
    expect(document.social.feedLastReadAt).toBeNull();
    expect(document.chat.groups).toEqual([]);
    expect(document.labelScans).toEqual([]);
    expect(document.files).toEqual([]);
    expect(document.account.signInProviders).toEqual([]);
    expect(document.account.profileClaims).toEqual({});
    expect(document.account.identities).toEqual([]);
  });
});
