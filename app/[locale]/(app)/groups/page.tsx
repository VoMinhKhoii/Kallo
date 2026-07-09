import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AllFriendsFeed } from '@/components/groups/all-friends-feed';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata.groups');
  return { title: t('title') };
}

/** Right-pane default when no friend is selected (desktop only — on mobile
 * the layout hides this pane entirely at the bare /groups route): every
 * friend's shared meal today, combined. Click a friend on the left to zoom
 * into just theirs instead. */
export default async function GroupsPage() {
  return <AllFriendsFeed />;
}
