'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { labelFor } from '@/components/groups/invite/profile-identity';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
import { useCreateReply } from '@/hooks/social/sharing/use-create-reply';
import { formatElapsed } from '@/lib/core/date/format-elapsed';
import type { ShareReply } from '@/lib/domain/social/shares/replies';

/** The reply thread under one meal post: existing replies plus a quiet,
 * toggle-to-open input. Stage-1 conversation lives here (no universal group
 * chat) — you reply to the meal itself. */
export function ShareReplies({
  shareId,
  replies,
  repliesTotal,
}: {
  shareId: string;
  replies: ShareReply[];
  repliesTotal: number;
}) {
  const t = useTranslations('groups.feed');
  const tWall = useTranslations('groups.wall');
  const locale = useLocale();
  const createReply = useCreateReply();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the composer when it opens (opening is an explicit user click).
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const submit = () => {
    const trimmed = body.trim();
    if (!trimmed || createReply.isPending) return;
    createReply.mutate(
      { shareId, body: trimmed },
      { onSuccess: () => setBody('') }
    );
  };

  return (
    <div className="mt-3 space-y-3">
      {repliesTotal > replies.length && (
        <p className="font-sans-display text-[#6E6D66] text-[12px]">
          {t('earlierReplies', { count: repliesTotal - replies.length })}
        </p>
      )}
      {replies.length > 0 && (
        <ul className="space-y-3">
          {replies.map((reply) => {
            const name = reply.isSelf ? tWall('you') : labelFor(reply.author);
            return (
              <li key={reply.id} className="flex gap-3">
                <ProfileAvatar
                  avatarUrl={reply.author.avatarUrl}
                  label={name}
                />
                {/* Avatar left, the reply itself in a pill on the right —
                    the same anatomy the Flutter ReplyRow draws, so a reply
                    looks like a reply on either platform. The name stays
                    OUTSIDE the pill: two type tiers inside one fill read as a
                    wall, and a body-only bubble keeps its height a function of
                    the message, which is the only reason to draw a pill. */}
                <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <b className="font-bold font-sans-display text-[#141413] text-[15px]">
                      {name}
                    </b>
                    <span className="font-sans-display text-[#6E6D66] text-[15px]">
                      {formatElapsed(reply.createdAt, locale)}
                    </span>
                  </div>
                  <p className="max-w-full break-words rounded-[18px] bg-kallo-border/50 px-3.5 py-2.5 font-medium font-sans-display text-[#141413] text-[15px] leading-[1.45]">
                    {reply.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {open ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onBlur={() => body.trim().length === 0 && setOpen(false)}
            placeholder={t('replyPlaceholder')}
            className="min-w-0 flex-1 border-[#E8E6DC] border-b bg-transparent pb-1 font-sans-display text-[#141413] text-[15px] placeholder:text-[#6E6D66] focus:border-[#141413] focus:outline-none"
          />
          {body.trim().length > 0 && (
            <button
              type="submit"
              disabled={createReply.isPending}
              className="shrink-0 font-medium font-sans-display text-[#141413] text-[13px] disabled:opacity-50"
            >
              {t('reply')}
            </button>
          )}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-sans-display text-[#6E6D66] text-[12px] transition-colors hover:text-[#141413]"
        >
          {t('reply')}
        </button>
      )}
    </div>
  );
}
