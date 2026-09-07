'use client';

import { useLocale, useTranslations } from 'next-intl';
import { labelFor } from '@/components/groups/invite/profile-identity';
import { ReplyComposer } from '@/components/groups/thread/reply-composer';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
import { formatElapsed } from '@/lib/core/date/format-elapsed';
import type { ShareReply } from '@/lib/domain/social/shares/replies';

/** The conversation under one meal post: every reply we hold, then the
 * always-open composer. Stage-1 conversation lives here (no universal group
 * chat) — you reply to the meal itself, on the meal's own page. */
export function ShareReplies({
  shareId,
  authorName,
  replies,
}: {
  shareId: string;
  /** The post author, for the composer's "Reply to <name>…" placeholder. */
  authorName: string;
  replies: ShareReply[];
}) {
  const t = useTranslations('groups.feed');
  const tWall = useTranslations('groups.wall');
  const locale = useLocale();

  return (
    <div className="mt-3 space-y-3">
      {replies.length > 0 ? (
        <ul className="space-y-3">
          {replies.map((reply) => {
            const name = reply.isSelf ? tWall('you') : labelFor(reply.author);
            return (
              <li key={reply.id} className="flex gap-3">
                <ProfileAvatar
                  avatarUrl={reply.author.avatarUrl}
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
      ) : (
        // A thread page that renders nothing between post and composer reads as
        // broken; one quiet line says the silence is the state, not a failure.
        <p className="font-sans-display text-[13px] text-kallo-text-muted">
          {t('noReplies')}
        </p>
      )}

      <ReplyComposer authorName={authorName} shareId={shareId} />
    </div>
  );
}
