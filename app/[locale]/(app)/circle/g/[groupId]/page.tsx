import { GroupFeed } from '@/components/groups/group-feed';

export default async function GroupFeedPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  return <GroupFeed groupId={groupId} />;
}
