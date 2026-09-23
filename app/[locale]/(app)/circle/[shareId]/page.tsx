'use client';

import { useParams } from 'next/navigation';
import { ShareThread } from '@/components/groups/share-thread/share-thread';

/** One shared meal's own page. The static `g` and `friends` segments take
 * precedence over this dynamic one, so a share id can never shadow them.
 *
 * A Client Component page on purpose: the thread is all client state, and
 * reading the id with `useParams` lets a navigation from the feed swap views
 * at once instead of waiting on the server for a param it cannot prefetch
 * (the Circle chrome is one shared App Shell for every share id). */
export default function ShareThreadPage() {
  const { shareId } = useParams<{ shareId: string }>();
  return <ShareThread shareId={shareId} />;
}
