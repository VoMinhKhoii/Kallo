import { FriendFeed } from '@/components/groups/friend-feed';

export default async function FriendFeedPage({
  params,
}: {
  params: Promise<{ friendId: string }>;
}) {
  const { friendId } = await params;
  return <FriendFeed friendUserId={friendId} />;
}
