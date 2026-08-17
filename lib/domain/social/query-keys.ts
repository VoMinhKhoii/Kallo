/**
 * TanStack Query keys for the circle and its sharing surfaces.
 *
 * They live here rather than beside the hooks that read them for the same
 * reason the meal keys do: the write side needs them and may not import from
 * `hooks/`. `feed/feed-cache.ts` decides which cached queries are share feeds,
 * and before this module it did so against bare string literals — so renaming
 * a root segment in a hook would have silently stopped reactions and replies
 * from reaching the mounted feeds, with no type error to catch it.
 *
 * Keys also cross features here: accepting a share refreshes the logging day,
 * renaming a profile refreshes the friends list, removing a friend refreshes
 * the wall. Holding the addresses in one module is what lets a hook invalidate
 * a neighbour's cache without importing the neighbour's hook.
 */

/** The ambient, most-recent-per-friend wall. The live query appends a
 *  timezone offset, so invalidating `all` still reaches it by prefix. */
export const circleFeedKeys = {
  all: ['circle-feed'] as const,
};

/** The actor's circle (accepted friends). */
export const friendsKeys = {
  all: ['friends'] as const,
};

/** The combined Friends thread — every friend's shares, paginated. */
export const friendsThreadFeedKeys = {
  all: ['friends-thread-feed'] as const,
};

/** The actor's "last checked the combined Friends feed" marker. */
export const friendsFeedReadMarkerKeys = {
  all: ['friends-feed-read-marker'] as const,
};

/** Chats (direct + group), their details and their meal feeds. */
export const chatGroupsKeys = {
  all: ['chat-groups'] as const,
  /** Prefix over every timezone-scoped chat list — invalidate this (not `all`)
   * from inside a feed queryFn, so refreshing the sidebar's unread
   * state can't invalidate the active query itself into a refetch loop. */
  lists: () => ['chat-groups', 'list'] as const,
  list: (timezoneOffset: number) =>
    ['chat-groups', 'list', timezoneOffset] as const,
  detail: (groupId: string) => ['chat-groups', groupId] as const,
  feed: (groupId: string) => ['chat-groups', groupId, 'feed'] as const,
};

/** Pending copy/split offers addressed to the actor. */
export const mealShareInvitesKeys = {
  all: ['meal-share-invites'] as const,
};

/** The signed-in user's own profile (auto-provisioned, so never null). */
export const profileKeys = {
  mine: ['my-profile'] as const,
};
