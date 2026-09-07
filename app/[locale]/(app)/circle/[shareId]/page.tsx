import { ShareThread } from '@/components/groups/thread/share-thread';

/** One shared meal's own page. The static `g` and `friends` segments take
 * precedence over this dynamic one, so a share id can never shadow them. */
export default async function ShareThreadPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  return <ShareThread shareId={shareId} />;
}
