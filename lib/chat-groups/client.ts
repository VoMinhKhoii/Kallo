// ---------------------------------------------------------------------------
// Chat groups — client-side REST helpers + response types
// ---------------------------------------------------------------------------
// Thin fetch wrappers around /api/v1/chat-groups/* used by the TanStack hooks.
// Mirrors lib/groups/client.ts's conventions; kept in its own module since
// chat-groups is a separate domain from the Circle friend-graph (see
// lib/actions/chat-groups.ts's module comment for why).

import type {
  ChatGroupDetail,
  ChatGroupIdentity,
  GroupMealFeedEntry,
  GroupMealFeedPage,
} from '@/lib/actions/chat-groups';
import { parseApiError } from '@/lib/errors';

export type {
  ChatGroupDetail,
  ChatGroupIdentity,
  GroupMealFeedEntry,
  GroupMealFeedPage,
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

/** Create a named group chat from a multi-select of the actor's friends. */
export function createChatGroup(input: {
  name: string;
  memberUserIds: string[];
}): Promise<{ id: string }> {
  return postJson<{ group: { id: string } }>('/api/v1/chat-groups', input).then(
    (r) => r.group
  );
}

/** Every chat (direct + group) the actor belongs to, most-recent first. */
export function fetchMyChatGroups(
  timezoneOffset: number
): Promise<ChatGroupIdentity[]> {
  return request<{ groups: ChatGroupIdentity[] }>(
    `/api/v1/chat-groups?timezoneOffset=${timezoneOffset}`
  ).then((r) => r.groups);
}

/** A group's detail + member list (membership-gated). */
export function fetchChatGroup(groupId: string): Promise<ChatGroupDetail> {
  return request<{ group: ChatGroupDetail }>(
    `/api/v1/chat-groups/${groupId}`
  ).then((r) => r.group);
}

/** One page of this group's shared-meal history, newest-first. Omit `before`
 * for the first page ("today's or the latest"); pass a prior page's
 * `nextCursor` to load older shares. */
export function fetchGroupMealFeed(
  groupId: string,
  before?: string
): Promise<GroupMealFeedPage> {
  const query = before ? `?before=${encodeURIComponent(before)}` : '';
  return request<GroupMealFeedPage>(
    `/api/v1/chat-groups/${groupId}/feed${query}`
  );
}
