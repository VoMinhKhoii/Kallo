// ---------------------------------------------------------------------------
// Chat message visibility — the one rule for "may this viewer see this message"
// ---------------------------------------------------------------------------
// Membership is checked where the thread is opened (requireGroupAccess); what
// varies per MESSAGE is who wrote it. In a named group both people of a block
// stay members, and each simply stops seeing the other's messages. Every read
// that surfaces a message — the thread list, the chat-list preview, the
// unread flag — folds in this predicate, so none can disagree with another.

import type { SQL, SQLWrapper } from 'drizzle-orm';
import { notBlockedWithSql } from '@/lib/domain/social/moderation/blocks';

export interface MessageColumns {
  senderId: SQLWrapper;
}

/** True when `viewerId` may see a message with these columns. */
export function visibleChatMessageSql(
  viewerId: string,
  message: MessageColumns
): SQL<boolean> {
  return notBlockedWithSql(viewerId, message.senderId);
}
