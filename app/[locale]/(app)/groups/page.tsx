import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { NoThreadSelected } from '@/components/groups/no-thread-selected';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata.groups');
  return { title: t('title') };
}

/** Right-pane default when no friend or group is selected (desktop only —
 * on mobile the layout hides this pane entirely at the bare /groups route):
 * a placeholder, not a thread opened automatically. Click a friend or group
 * on the left to view its content. */
export default async function GroupsPage() {
  return <NoThreadSelected />;
}
