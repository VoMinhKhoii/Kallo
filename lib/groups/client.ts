// ---------------------------------------------------------------------------
// Group tracking — client-side REST helpers + response types
// ---------------------------------------------------------------------------
// Thin fetch wrappers around /api/v1/groups/* used by the TanStack hooks. Web
// calls these REST endpoints (the same contract the mobile port will use). The
// pure service-fn response shapes are re-exported as types from the server file
// for client typing only.

import type {
  CircleFeedEntry,
  CircleMember,
  FriendsThreadFeedPage,
  PublicProfile,
} from '@/lib/actions/groups';
import { parseApiError } from '@/lib/errors';

export type {
  CircleFeedEntry,
  CircleMember,
  FriendsThreadFeedPage,
  PublicProfile,
};

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw parseApiError(body);
  }
  return response.json() as Promise<T>;
}

function postJson<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function fetchCircleFeed(
  timezoneOffset: number
): Promise<CircleFeedEntry[]> {
  return request<{ feed: CircleFeedEntry[] }>(
    `/api/v1/groups/feed?timezoneOffset=${timezoneOffset}`
  ).then((r) => r.feed);
}

/** One page of the combined Friends thread's shared-meal history (every
 * accepted friend, merged, excluding the actor), newest-first. Omit `before`
 * for the first page ("today's or the latest"); pass a prior page's
 * `nextCursor` to load older shares. */
export function fetchFriendsThreadFeed(
  before?: string
): Promise<FriendsThreadFeedPage> {
  const query = before ? `?before=${encodeURIComponent(before)}` : '';
  return request<FriendsThreadFeedPage>(`/api/v1/groups/friends/feed${query}`);
}

export function fetchFriends(): Promise<CircleMember[]> {
  return request<{ circle: CircleMember[] }>('/api/v1/groups/friends').then(
    (r) => r.circle
  );
}

/** The user's own profile — auto-provisioned server-side, so never null. */
export function fetchMyProfile(): Promise<PublicProfile> {
  return request<{ profile: PublicProfile }>('/api/v1/groups/profile').then(
    (r) => r.profile
  );
}

export function saveMyProfile(input: {
  handle: string;
  /** Omitted = keep the stored name; `null` = clear it back to the handle. */
  displayName?: string | null;
}): Promise<PublicProfile> {
  return postJson<{ profile: PublicProfile }>(
    '/api/v1/groups/profile',
    input
  ).then((r) => r.profile);
}

/** Accept an invite link, identified by the inviter's link slug. */
export function acceptInvite(slug: string) {
  return postJson<{ status: 'accepted'; inviter: PublicProfile }>(
    '/api/v1/groups/invite/accept',
    { slug }
  );
}

/** Remove a connection (the pair can re-invite later). */
export function removeFriend(targetUserId: string) {
  return request<{ removed: boolean }>('/api/v1/groups/friends/remove', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUserId }),
  });
}

export function blockFriend(targetUserId: string) {
  return postJson<{ friendshipId: string; status: string }>(
    '/api/v1/groups/friends/block',
    { targetUserId }
  );
}

export function setMealShareVisibility(
  mealId: string,
  visibility: 'private' | 'circle'
) {
  return postJson<{
    mealId: string;
    visibility: 'private' | 'circle';
    shareId: string;
  }>('/api/v1/groups/shares', { mealId, visibility });
}
