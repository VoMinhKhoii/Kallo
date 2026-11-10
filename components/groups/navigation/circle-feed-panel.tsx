'use client';

import type { ReactNode } from 'react';
import { FriendsFeed } from '@/components/groups/friends-feed';
import { GroupFeed } from '@/components/groups/group-feed';
import { usePathname } from '@/i18n/navigation';
import { circleFeedSelection } from '@/lib/domain/social/circle-routes';

/** Layout-owned so switching feeds never waits for a new RSC route payload.
 * Only the selected feed mounts: unopened circles must not be marked read. */
export function CircleFeedPanel({ children }: { children: ReactNode }) {
  const selection = circleFeedSelection(usePathname());
  if (selection === 'all') return <FriendsFeed />;
  if (selection) return <GroupFeed key={selection} groupId={selection} />;
  return children;
}
