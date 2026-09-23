'use client';

import { useParams } from 'next/navigation';
import { GroupFeed } from '@/components/groups/group-feed';

/** A group's feed. A Client Component page for the same reason as the share
 * thread: the feed is client state, and `useParams` makes switching groups
 * from the pill row instant rather than a server round trip for the id. */
export default function GroupFeedPage() {
  const { groupId } = useParams<{ groupId: string }>();
  return <GroupFeed groupId={groupId} />;
}
