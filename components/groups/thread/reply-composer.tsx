'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { labelFor } from '@/components/groups/invite/profile-identity';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
import { useMyProfile } from '@/hooks/profile/use-profile';
import { useCreateReply } from '@/hooks/social/sharing/use-create-reply';

/**
 * The always-open reply field at the foot of a post's thread: your own avatar
 * beside a rounded field addressed to the author ("Reply to Minh…"). No
 * toggle — a thread page you opened to read the conversation is a page you
 * came to answer, and a link that only reveals an input is one tap of nothing.
 * Send appears once there is something to send, so the resting row stays quiet.
 */
export function ReplyComposer({
  shareId,
  authorName,
}: {
  shareId: string;
  authorName: string;
}) {
  const t = useTranslations('groups.feed');
  const { data: profile } = useMyProfile();
  const createReply = useCreateReply();
  const [body, setBody] = useState('');

  // The disc stands in while the profile loads: the row's geometry is the same
  // either way, so the field never shifts sideways when the avatar arrives.
  const myLabel = profile ? labelFor(profile) : t('you');

  const submit = () => {
    const trimmed = body.trim();
    if (!trimmed || createReply.isPending) return;
    createReply.mutate(
      { shareId, body: trimmed },
      { onSuccess: () => setBody('') }
    );
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex items-center gap-3"
    >
      <ProfileAvatar avatarUrl={profile?.avatarUrl ?? null} label={myLabel} />
      <input
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={t('replyTo', { name: authorName })}
        className="min-w-0 flex-1 rounded-full border border-kallo-border bg-kallo-surface px-3.5 py-2.5 font-sans-display text-[15px] text-kallo-text placeholder:text-kallo-text-muted focus:border-kallo-text focus:outline-none"
      />
      {body.trim().length > 0 && (
        <button
          type="submit"
          disabled={createReply.isPending}
          className="shrink-0 font-medium font-sans-display text-[13px] text-kallo-text disabled:opacity-50"
        >
          {t('reply')}
        </button>
      )}
    </form>
  );
}
