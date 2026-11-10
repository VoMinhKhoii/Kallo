'use client';

import { notFound } from 'next/navigation';
import { FriendsFeed } from '@/components/groups/friends-feed';
import { GroupFeed } from '@/components/groups/group-feed';
import { usePathname } from '@/i18n/navigation';
import { circleFeedSelection } from '@/lib/domain/social/circle-routes';

/** URL-driven so switching feeds never waits for a new RSC route payload.
 * Only the selected feed mounts: unopened circles must not be marked read. */
export function CircleFeedPanel() {
  const pathname = usePathname();
  const selection = circleFeedSelection(pathname);
  if (pathname.startsWith('/circle/g/') && !selection) notFound();
  if (selection === 'all') return <FriendsFeed />;
  if (selection) return <GroupFeed key={selection} groupId={selection} />;
  return null;
}
