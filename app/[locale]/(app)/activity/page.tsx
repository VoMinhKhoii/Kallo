import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ActivityPage } from '@/components/activity/activity-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata.activity');
  return { title: t('title') };
}

/** The Activity surface — every notification addressed to me, newest first.
 * A thin server shell: the feed, its badge clear, and the invite actions are
 * all client state. */
export default function ActivityRoute() {
  return <ActivityPage />;
}
