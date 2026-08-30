/**
 * TanStack Query keys for the activity surfaces.
 *
 * They live beside the domain rather than beside the hooks for the same reason
 * the circle keys do: the write side needs them and may not import from
 * `hooks/`. Marking a row read has to reach the badge query, and accepting an
 * invite from an activity card has to reach the feed — both happen in mutation
 * callbacks that never mount the reading hook.
 */

/** Everything activity-related — the prefix a producer invalidates. */
export const notificationKeys = {
  all: ['notifications'] as const,
  /** The paginated activity feed. */
  feed: ['notifications', 'feed'] as const,
  /** The unseen count behind the nav badge, polled every 30s. */
  badge: ['notifications', 'badge'] as const,
};
