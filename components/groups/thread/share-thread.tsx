'use client';

import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CircleError } from '@/components/groups/circle-error';
import { CircleWallSkeleton } from '@/components/groups/circle-wall-skeleton';
import { FeedEntry } from '@/components/groups/feed-entry';
import { labelFor } from '@/components/groups/invite/profile-identity';
import { ShareReplies } from '@/components/groups/share-replies';
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
          <div className="p-4">
            <FeedEntry entry={data.entry} />
            <ShareReplies
              authorName={labelFor(data.entry.friend)}
              replies={data.entry.replies}
              shareId={shareId}
            />
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
