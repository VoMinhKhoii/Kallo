// ---------------------------------------------------------------------------
// Notifications — client-side REST helpers
// ---------------------------------------------------------------------------
// Thin fetch wrappers around /api/v1/notifications/* used by the TanStack
// hooks in hooks/notifications/. The same contract the Flutter client consumes.

import { postJson, request } from '@/lib/api/client-fetch';
import type { NotificationFeedPage } from './contracts';

/** One page of activity, newest first. Omit `before` for the first page. */
export function fetchNotifications(
  before?: string
): Promise<NotificationFeedPage> {
  const query = before ? `?before=${encodeURIComponent(before)}` : '';
  return request<NotificationFeedPage>(`/api/v1/notifications${query}`);
}

/** Unseen count for the nav badge. */
export function fetchNotificationBadge(): Promise<{ unseen: number }> {
  return request<{ unseen: number }>('/api/v1/notifications/badge');
}

/** Clear the badge for everything at or before `before` (an ISO instant). */
export function postMarkNotificationsSeen(
  before: string
): Promise<{ seen: number }> {
  return postJson<{ seen: number }>('/api/v1/notifications/seen', { before });
}

/** Dim rows on tap. */
export function postMarkNotificationsRead(
  ids: string[]
): Promise<{ read: number }> {
  return postJson<{ read: number }>('/api/v1/notifications/read', { ids });
}
