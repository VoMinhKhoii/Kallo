// ---------------------------------------------------------------------------
// Chat groups — unified 1:1 + group messaging service functions
// ---------------------------------------------------------------------------
// One chat concept: a group is N >= 2 members. Domain seams live in the
// sibling chat-groups modules; this facade preserves the established public
// import path for routes, clients, friendship actions, and tests.

export {
  createChatGroup,
  getChatGroup,
  listMyChatGroups,
} from '@/lib/actions/chat-groups/create-and-list';
export { listGroupMealFeed } from '@/lib/actions/chat-groups/feed';
export {
  getOrCreateDirectChatGroup,
  leaveChatGroup,
} from '@/lib/actions/chat-groups/membership';
export {
  listChatGroupMessages,
  sendChatGroupMessage,
} from '@/lib/actions/chat-groups/messages';
export { listGroupTimeline } from '@/lib/actions/chat-groups/timeline';
export type {
  ChatGroupDetail,
  ChatGroupIdentity,
  ChatGroupMember,
  ChatGroupMessage,
  GroupMealFeedEntry,
  GroupMealFeedPage,
  GroupTimelineEntry,
  GroupTimelineMealEntry,
  GroupTimelineMessageEntry,
  GroupTimelinePage,
} from '@/lib/actions/chat-groups/types';
