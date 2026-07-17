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
  ChatGroupMessage,
  GroupMealFeedEntry,
  GroupMealFeedPage,
  GroupTimelineEntry,
  GroupTimelineMessageEntry,
  GroupTimelinePage,
} from '@/lib/actions/chat-groups';
import { parseApiError } from '@/lib/errors';

export type {
  ChatGroupDetail,
  ChatGroupIdentity,
  ChatGroupMessage,
  GroupMealFeedEntry,
  GroupMealFeedPage,
  GroupTimelineEntry,
  GroupTimelineMessageEntry,
  GroupTimelinePage,
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

/** One tuple-seek page of messages and privacy-bounded meal shares. */
export function fetchGroupTimeline(
  groupId: string,
  before?: string
): Promise<GroupTimelinePage> {
  const query = before ? `?before=${encodeURIComponent(before)}` : '';
  return request<GroupTimelinePage>(
    `/api/v1/chat-groups/${groupId}/timeline${query}`
  );
}

/** Post through the established messages endpoint. */
export function sendGroupMessage(
  groupId: string,
  body: string
): Promise<ChatGroupMessage> {
  return postJson<{ message: ChatGroupMessage }>(
    `/api/v1/chat-groups/${groupId}/messages`,
    { body }
  ).then((response) => response.message);
}

/** Remove the actor's own membership from a named chat group. */
export function leaveGroup(groupId: string): Promise<{ left: true }> {
  return request<{ left: true }>(`/api/v1/chat-groups/${groupId}/leave`, {
    method: 'DELETE',
  });
}
