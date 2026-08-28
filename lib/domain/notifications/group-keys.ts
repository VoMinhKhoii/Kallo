// ---------------------------------------------------------------------------
// Notifications — aggregation key builders
// ---------------------------------------------------------------------------
// A group key is the aggregation identity of a notification: together with the
// recipient it is the conflict target of the open-aggregate unique index, so
// two events that should collapse into one row ("X and 2 others reacted") must
// produce the same string, and two that must stay separate must not.
//
// Shape is always '<type>:<id>' — the type prefix keeps keys from colliding
// across event kinds that happen to reference the same uuid (a reaction and a
// reply on the same share are different rows).
//
// Pure by design: producers call these inside their transaction, and the
// activity feed never parses them back.

export function friendJoinedKey(friendshipId: string): string {
  return `friend.joined:${friendshipId}`;
}

export function groupAddedKey(groupId: string): string {
  return `group.added:${groupId}`;
}

/** Keyed by the SOURCE meal, not the invite: re-offering the same meal after a
 *  dismiss refreshes the open row instead of stacking a second card. Per-
 *  recipient separation comes from recipient_id in the unique index. */
export function shareInviteKey(sourceMealId: string): string {
  return `share.invite:${sourceMealId}`;
}

export function shareInviteAcceptedKey(inviteId: string): string {
  return `share.invite_accepted:${inviteId}`;
}

export function shareReactionKey(shareId: string): string {
  return `share.reaction:${shareId}`;
}

export function shareReplyKey(shareId: string): string {
  return `share.reply:${shareId}`;
}

export function shareLoggedKey(shareId: string): string {
  return `share.logged:${shareId}`;
}
