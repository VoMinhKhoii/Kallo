// ---------------------------------------------------------------------------
// Notifications — producer-side vocabulary
// ---------------------------------------------------------------------------
// The v1 event catalog (docs/NOTIFICATIONS.md). `chat.message` is deliberately
// absent from this union even though the CHECK constraint reserves it: chat
// unread is already carried by chat_group_members.lastReadAt, so it is a
// push-only event that must never create a row (Gate 3 — double-badging).

export type NotificationType =
  | 'friend.joined'
  | 'group.added'
  | 'share.invite'
  | 'share.invite_accepted'
  | 'share.reaction'
  | 'share.reply'
  | 'share.logged';

/** One "tell this person about this" instruction handed to `notify()`. */
export interface NotifyInput {
  recipientId: string;
  type: NotificationType;
  /** Who did it. Equal to `recipientId` means the event is dropped (Gate 2). */
  actorId: string;
  /** What happened — the invite / friendship row the card renders live. */
  objectType?: string;
  objectId?: string;
  /** Where tapping goes, when that is not the object (e.g. the chat group). */
  targetType?: string;
  targetId?: string;
  /** Aggregation identity, built by ./group-keys. */
  groupKey: string;
  /** Presentation payload merged into the row on refresh (names, previews). */
  data?: Record<string, unknown>;
}
