import type { SharedMealEntry } from '@/lib/groups/meal-feed';
import type { PublicIdentity } from '@/lib/groups/public-identity';

export interface ChatGroupIdentity {
  id: string;
  kind: 'direct' | 'group';
  /** Display title: the group name, or the other member's label for direct. */
  title: string;
  avatarSeed: string | null;
  updatedAt: string;
  /** Most recent message's text (raw, untruncated — the UI clips it). */
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  /** True when the most recent message OR shared meal postdates this actor's
   * read marker (bumped when the thread's feed is opened). */
  unread: boolean;
  /** Most recent shared-meal timestamp among this chat's members, today. */
  lastMealSharedAt: string | null;
}

export interface ChatGroupMember extends PublicIdentity {
  role: string;
}

export interface ChatGroupDetail {
  id: string;
  kind: 'direct' | 'group';
  name: string | null;
  members: ChatGroupMember[];
  /** The requesting actor's own role — gates owner-only UI (rename, remove). */
  myRole: 'owner' | 'member';
}

export interface ChatGroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export type GroupMealFeedEntry = SharedMealEntry;

export interface GroupMealFeedPage {
  entries: GroupMealFeedEntry[];
  nextCursor: string | null;
}
