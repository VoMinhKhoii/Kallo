'use client';

import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { tintFor } from '@/components/groups/avatar-tint';
import { useSendGroupMessage } from '@/hooks/social/use-group-timeline';
import type { PublicProfile } from '@/lib/groups/client';

interface GroupComposerProps {
  groupId: string;
  groupName: string;
  profile: PublicProfile | undefined;
}

/** Quiet top-of-panel composer that posts through the established message
 * route; cache reconciliation lives in useSendGroupMessage. */
export function GroupComposer({
  groupId,
  groupName,
  profile,
}: GroupComposerProps) {
  const t = useTranslations('groups.feed');
  const [body, setBody] = useState('');
  const send = useSendGroupMessage(groupId, profile);
  const label = profile?.displayName?.trim() || profile?.handle || t('you');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = body.trim();
    if (!message || !profile) return;
    send.mutate(message, {
      onSuccess: () => setBody(''),
      onError: () => toast.error(t('sendError')),
    });
  };

  return (
    <form
      onSubmit={submit}
      className="flex shrink-0 items-center gap-3 border-nham-border/60 border-b p-4"
    >
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${tintFor(profile?.avatarSeed ?? null, label)}`}
      >
        <span className="font-bold font-sans-display text-[12px] text-nham-btn">
          {label.charAt(0).toUpperCase()}
        </span>
      </span>
      <input
        value={body}
        onChange={(event) => setBody(event.target.value)}
        disabled={send.isPending}
        maxLength={2000}
        aria-label={t('composerLabel')}
        placeholder={t('composerPlaceholder', { name: groupName })}
        className="min-w-0 flex-1 bg-transparent font-sans-display text-[13px] text-nham-text outline-none placeholder:text-nham-text-muted disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={!body.trim() || !profile || send.isPending}
        className="rounded-full border border-nham-border/60 bg-transparent px-4 py-[7px] font-medium font-sans-display text-[12.5px] text-nham-text transition-colors hover:border-nham-accent/50 disabled:opacity-50"
      >
        {t('send')}
      </button>
    </form>
  );
}
