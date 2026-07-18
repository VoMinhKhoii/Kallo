// ---------------------------------------------------------------------------
// Chat groups — unified 1:1 + group messaging service functions
// ---------------------------------------------------------------------------
// One chat concept: a group is N >= 2 members. Domain seams live in the
// sibling chat-groups modules; this facade preserves the established public
// import path for routes, clients, friendship actions, and tests.

export {
  createChatGroup,
  listMyChatGroups,
} from '@/lib/actions/chat-groups/create-and-list';
export {
  getChatGroup,
  renameChatGroup,
} from '@/lib/actions/chat-groups/details';
export { getOrCreateDirectChatGroup } from '@/lib/actions/chat-groups/direct-chats';
export { listGroupMealFeed } from '@/lib/actions/chat-groups/feed';
export {
  addChatGroupMembers,
  leaveChatGroup,
  removeChatGroupMember,
} from '@/lib/actions/chat-groups/membership';
export {
  listChatGroupMessages,
  sendChatGroupMessage,
} from '@/lib/actions/chat-groups/messages';
export type {
  ChatGroupDetail,
  ChatGroupIdentity,
  ChatGroupMember,
  ChatGroupMessage,
  GroupMealFeedEntry,
  GroupMealFeedPage,
} from '@/lib/actions/chat-groups/types';
