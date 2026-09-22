'use client';

import { useLocale, useTranslations } from 'next-intl';
import { labelFor } from '@/components/groups/invite/profile-identity';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
import { SurfaceState } from '@/components/shared/surface-state/surface-state';
import { formatElapsed } from '@/lib/core/date/format-elapsed';
import type { ShareReply } from '@/lib/domain/social/shares/replies';

/** The conversation under one meal post and nothing else — no composer, no
 * page chrome. It owns its own empty state, so the page above never has to ask
 * how many replies there are. Stage-1 conversation lives here (no universal
 * group chat): you reply to the meal itself, on the meal's own page. */
export function ShareReplies({ replies }: { replies: ShareReply[] }) {
  const t = useTranslations('groups.feed');
  const tWall = useTranslations('groups.wall');
  const locale = useLocale();

  if (replies.length === 0) {
    // The surface's own empty state, cast and all — the answer every other
    // empty list in the app gives, and what mobile's thread page shows. It was
    // one muted line for a while, which on a page with a whole blank column
    // under it read as content that never finished drawing rather than as an
    // empty conversation. `compact` is the size that belongs under a single
    // post.
    //
    // `flex-1` and nothing else: [SurfaceState] already centres its own
    // content, so taking the column's spare room is all it needs to sit in the
    // middle of the void. The page does not get to know we are empty —
    // `thread-feed.tsx` owns its empty state the same way.
    // `role="status"` because this arrives dynamically: the page renders a
    // skeleton while the thread query is pending and swaps to content when it
    // resolves, so a screen reader that has already settled on the page never
    // hears "No replies yet" unless it is a polite live region. `SurfaceState`
    // announces itself only for `kind="error"`, which is the loud one.
    return (
      <div className="flex flex-1" role="status">
        <SurfaceState
          area="circle"
          className="flex-1"
          compact
          kind="empty"
          subtitle={t('noRepliesBody')}
          title={t('noReplies')}
        />
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {replies.map((reply) => {
        const name = reply.isSelf ? tWall('you') : labelFor(reply.author);
        return (
          <li key={reply.id} className="flex gap-3">
            {/* size-7 (28), a step under the post author's size-9 (36): the
                two were the same disc, so a reply read as another post. The
                LEFT EDGES still line up — both rows are `flex gap-3` from the
                same container edge — which is what makes the page one column
                of faces. Mirrors mobile's 36/28 pair. */}
            <ProfileAvatar
              avatarUrl={reply.author.avatarUrl}
              className="size-7"
              label={name}
            />
            {/* Avatar left, name and time above the words — no pill. On a
                page that is nothing BUT the conversation, a fill around
                every reply draws a stack of boxes instead of a thread; the
                avatar column already says where each message starts. */}
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <b className="font-bold font-sans-display text-[15px] text-kallo-text">
                  {name}
                </b>
                <span className="font-sans-display text-[15px] text-kallo-text-muted">
                  {formatElapsed(reply.createdAt, locale)}
                </span>
              </div>
              <p className="max-w-full break-words font-medium font-sans-display text-[15px] text-kallo-text leading-[1.45]">
                {reply.body}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
