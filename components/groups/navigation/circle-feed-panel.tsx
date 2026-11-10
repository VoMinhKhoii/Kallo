'use client';

import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { FriendsFeed } from '@/components/groups/friends-feed';
import { GroupFeed } from '@/components/groups/group-feed';
import { usePathname } from '@/i18n/navigation';
import { circleFeedSelection } from '@/lib/domain/social/circle-routes';

/** Layout-owned so switching feeds never waits for a new RSC route payload.
 * Only the selected feed mounts: unopened circles must not be marked read. */
export function CircleFeedPanel({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const selection = circleFeedSelection(pathname);
  if (pathname.startsWith('/circle/g/') && !selection) notFound();
  return (
    <>
      {selection === 'all' ? (
        <FriendsFeed />
      ) : selection ? (
        <GroupFeed key={selection} groupId={selection} />
      ) : null}
      {/* Next must still render the leaf segment (null on feed routes) to
       * validate instant navigation. Dropping children prevented validation.
       * Thread/friends routes retain their normal flex layout. */}
      <div
        className="flex min-h-0 flex-1 flex-col"
        style={selection ? { display: 'none' } : undefined}
      >
        {children}
      </div>
    </>
  );
}
