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
  ChatGroupMember,
  ChatGroupMessage,
  GroupMealFeedEntry,
  GroupMealFeedPage,
} from '@/lib/actions/chat-groups';
import { parseApiError } from '@/lib/errors';

export type {
  ChatGroupDetail,
  ChatGroupIdentity,
  ChatGroupMember,
  ChatGroupMessage,
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

/** Add accepted friends of the actor to an existing named group. */
export function addGroupMembers(
  groupId: string,
  memberUserIds: string[]
): Promise<{ added: number }> {
  return postJson<{ added: number }>(`/api/v1/chat-groups/${groupId}/members`, {
    memberUserIds,
  });
}

/** Owner-only: remove one member from a named group. */
export function removeGroupMember(
  groupId: string,
  memberUserId: string
): Promise<{ removed: true }> {
  return request<{ removed: true }>(
    `/api/v1/chat-groups/${groupId}/members/${memberUserId}`,
    { method: 'DELETE' }
  );
}

/** Owner-only: rename a named group. */
export function renameGroup(
  groupId: string,
  name: string
): Promise<{ name: string }> {
  return request<{ name: string }>(`/api/v1/chat-groups/${groupId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}
