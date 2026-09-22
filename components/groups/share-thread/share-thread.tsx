'use client';

import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CircleError } from '@/components/groups/circle-error';
import { CircleWallSkeleton } from '@/components/groups/circle-wall-skeleton';
import { FeedEntry } from '@/components/groups/feed/feed-entry';
import { labelFor } from '@/components/groups/invite/profile-identity';
import { ReplyComposer } from '@/components/groups/share-thread/reply-composer';
import { ShareReplies } from '@/components/groups/share-thread/share-replies';
import { SurfaceState } from '@/components/shared/surface-state/surface-state';
import { useShareThread } from '@/hooks/social/circle/use-share-thread';
import { Link } from '@/i18n/navigation';

/**
 * One post's own page: the post exactly as the feed draws it, then its whole
 * conversation and the composer. Reached from a feed row's reply glyph and
 * from every share notification, so it must answer three states honestly —
 * loading, a failed read (retryable), and a share that is genuinely gone,
 * which is a destination, not an error.
 */
export function ShareThread({ shareId }: { shareId: string }) {
  const t = useTranslations('groups.thread');
  const { data, isPending, isError, isFetching, refetch } =
    useShareThread(shareId);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-1 flex shrink-0 items-center gap-2 pb-2">
        <Link
          href="/circle"
          aria-label={t('back')}
          className="-ml-1 inline-flex size-8 items-center justify-center rounded-full text-kallo-text transition-colors hover:bg-kallo-track"
        >
          <ArrowLeft className="size-[18px]" />
        </Link>
        <h2 className="font-bold font-sans-display text-[15px] text-kallo-text">
          {t('title')}
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isPending ? (
          <CircleWallSkeleton />
        ) : isError ? (
          <CircleError onRetry={() => void refetch()} isRetrying={isFetching} />
        ) : data ? (
          // A column that FILLS the scroll area rather than one that
          // shrink-wraps: it is what lets an empty thread's state centre in
          // the void between the post and the field, and it pins the composer
          // to the bottom edge while it does (the same shape mobile's docked
          // composer gives that page). With replies, nothing takes the spare
          // room and the composer follows the conversation as before.
          <div className="flex min-h-full flex-col p-4">
            <FeedEntry entry={data.entry} />
            {data.entry.replies.length > 0 ? (
              <div className="mt-3">
                <ShareReplies replies={data.entry.replies} />
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <ShareReplies replies={data.entry.replies} />
              </div>
            )}
            <div className="mt-3">
              <ReplyComposer
                authorName={
                  data.entry.isSelf ? undefined : labelFor(data.entry.friend)
                }
                shareId={shareId}
              />
            </div>
          </div>
        ) : (
          <SurfaceState
            area="circle"
            kind="empty"
            subtitle={t('goneBody')}
            title={t('gone')}
          />
        )}
      </div>
    </div>
  );
}
