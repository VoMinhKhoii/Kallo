import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { FriendsFeed } from '@/components/groups/friends-feed';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata.groups');
  return { title: t('title') };
}

/** The default "All" view: every accepted friend's shared meals merged into
 * one Threads-style feed. The bare /groups route — the pill row and group
 * routes navigate away from here. */
export default async function GroupsPage() {
  return <FriendsFeed />;
}
