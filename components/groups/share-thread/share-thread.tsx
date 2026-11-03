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
 * One post's own page: the post exactly as the feed draws it, then the reply
 * field, then its whole conversation. Reached from a feed row's reply glyph and
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
          <ArrowLeft className="size-icon-primary" />
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
          // Post, then the reply field, then the conversation — the Threads
          // web order: the field sits where the eye already is after reading
          // the meal, instead of at the foot of a page that is usually empty.
          //
          // A column that FILLS the scroll area rather than one that
          // shrink-wraps: it is what gives an empty thread's state room to
          // centre in, under the field.
          //
          // The page does NOT branch on how many replies there are — that is
          // `ShareReplies`' own question, and asking it here too meant one
          // predicate in two files kept in sync by comments. It takes the
          // spare room itself when it has nothing to list.
          <div className="flex min-h-full flex-col gap-3 p-4">
            <FeedEntry entry={data.entry} />
            <ReplyComposer
              authorName={
                data.entry.isSelf ? undefined : labelFor(data.entry.friend)
              }
              shareId={shareId}
            />
            <ShareReplies replies={data.entry.replies} />
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
