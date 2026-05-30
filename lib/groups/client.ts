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
  PublicProfile,
} from '@/lib/actions/groups';
import { parseApiError } from '@/lib/errors';

export type { CircleFeedEntry, CircleMember, PublicProfile };

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

export function fetchFriends(): Promise<CircleMember[]> {
  return request<{ circle: CircleMember[] }>('/api/v1/groups/friends').then(
    (r) => r.circle
  );
}

export function searchFriendByHandle(
  handle: string
): Promise<PublicProfile | null> {
  return request<{ profile: PublicProfile | null }>(
    `/api/v1/groups/friends/search?handle=${encodeURIComponent(handle)}`
  ).then((r) => r.profile);
}

export function requestFriend(targetUserId: string) {
  return postJson<{ friendshipId: string; status: string }>(
    '/api/v1/groups/friends/request',
    { targetUserId }
  );
}

export function acceptFriend(friendshipId: string) {
  return postJson<{ friendshipId: string; status: string }>(
    '/api/v1/groups/friends/accept',
    { friendshipId }
  );
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
