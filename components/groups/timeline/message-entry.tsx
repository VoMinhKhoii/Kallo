'use client';

import { useLocale, useTranslations } from 'next-intl';
import { tintFor } from '@/components/groups/avatar-tint';
import type { GroupTimelineMessageEntry } from '@/lib/chat-groups/client';
import { formatElapsed } from '@/lib/date/format-elapsed';

/** A message rendered with the same flat post head as a shared meal, followed
 * by quiet plain body copy instead of nutrition and meal actions. */
export function MessageEntry({ entry }: { entry: GroupTimelineMessageEntry }) {
  const t = useTranslations('groups.wall');
  const locale = useLocale();
  const label = entry.isSelf
    ? t('you')
    : entry.author.displayName?.trim() || entry.author.handle;

  return (
    <div className="flex gap-3">
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${tintFor(entry.author.avatarSeed, label)}`}
      >
        <span className="font-bold font-sans-display text-[12px] text-nham-btn">
          {label.charAt(0).toUpperCase()}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-[3px] flex items-baseline gap-2">
          <b className="font-bold font-sans-display text-[13px] text-nham-text">
            {label}
          </b>
          <span className="font-sans-display text-[11px] text-nham-text-muted">
            {formatElapsed(entry.sentAt, locale)}
          </span>
        </div>
        <p className="whitespace-pre-wrap break-words font-sans-display text-[13px] text-nham-text leading-[1.5]">
          {entry.body}
        </p>
      </div>
    </div>
  );
}
