import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { CircleWallSkeleton } from '@/components/groups/circle-wall-skeleton';
import { CircleFeedPanel } from '@/components/groups/navigation/circle-feed-panel';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata.groups');
  return { title: t('title') };
}

/** The same URL-driven renderer handles All and local group selections. */
export default async function GroupsPage() {
  return (
    <Suspense fallback={<CircleWallSkeleton />}>
      <CircleFeedPanel />
    </Suspense>
  );
}
