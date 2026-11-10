import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata.groups');
  return { title: t('title') };
}

/** The layout's CircleFeedPanel renders All from the current pathname. */
export default async function GroupsPage() {
  return null;
}
