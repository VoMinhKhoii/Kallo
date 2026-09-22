'use client';

import { ArrowUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { labelFor } from '@/components/groups/invite/profile-identity';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
import { useMyProfile } from '@/hooks/profile/use-profile';
import { useCreateReply } from '@/hooks/social/sharing/use-create-reply';

/**
 * The always-open reply field at the foot of a post's thread: one full-width
 * pill holding your own avatar, a field addressed to the author ("Reply to
 * Minh…") and the send button. No toggle — a thread page you opened to read
 * the conversation is a page you came to answer, and a link that only reveals
 * an input is one tap of nothing.
 *
 * One pill, not three things in a row (2026-09-22). The avatar used to sit
 * OUTSIDE the field with the word "Reply" out beyond it: the disc read as a
 * person standing next to a form rather than as the author of what was being
 * typed, and a verb in running type beside a field reads as a second
 * placeholder. Send is now the app's own send affordance — the arrow-up button
 * from the logging composer — and still appears only once there is something to
 * send, so the resting row stays quiet. Mirrors the Flutter dock in
 * `apps/mobile-flutter/lib/features/circle/widgets/thread/reply_pill.dart`.
 */
export function ReplyComposer({
  shareId,
  authorName,
}: {
  shareId: string;
  /** The post author, and the one home of this rule: callers omit it on your
   * OWN post, because "Reply to <your handle>…" addresses the reader to
   * themselves. Absent, the placeholder falls back to the plain "Reply…". */
  authorName?: string;
}) {
  const t = useTranslations('groups.feed');
  const { data: profile } = useMyProfile();
  const createReply = useCreateReply();
  const [body, setBody] = useState('');

  // The disc stands in while the profile loads: the row's geometry is the same
  // either way, so the field never shifts sideways when the avatar arrives.
  const myLabel = profile ? labelFor(profile) : t('you');
  const hasDraft = body.trim().length > 0;

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
      // The pill paints the box now, so the input inside it must not: hence
      // `border-none bg-transparent` on the field below. `focus-within` moves
      // the focus ring out to the shell with the rest of the border.
      className="flex w-full items-center gap-2 rounded-full border border-kallo-border bg-kallo-surface py-1 pr-1 pl-1.5 transition-colors focus-within:border-kallo-text"
    >
      {/* size-7 (28), the replies' disc — what is being written here is a
          reply, not a post. Inside the pill, mirroring mobile. */}
      <ProfileAvatar
        avatarUrl={profile?.avatarUrl ?? null}
        className="size-7"
        label={myLabel}
      />
      <input
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={
          authorName
            ? t('replyTo', { name: authorName })
            : t('replyPlaceholder')
        }
        className="min-w-0 flex-1 border-none bg-transparent py-1.5 font-sans-display text-[15px] text-kallo-text placeholder:text-kallo-text-muted focus:outline-none"
      />
      {/* The morph: width, opacity and scale from one transition, so the
          button grows out of the pill's right edge as the field gives the
          space back rather than popping into place. `hidden` would have no
          animation and `opacity-0` alone would leave a real button under the
          cursor with nothing to send, so the collapsed state is also
          `pointer-events-none` and `aria-hidden`. */}
      <span
        aria-hidden={!hasDraft}
        className={`flex shrink-0 overflow-hidden transition-all duration-300 ease-out ${
          hasDraft
            ? 'w-8 scale-100 opacity-100'
            : 'pointer-events-none w-0 scale-85 opacity-0'
        }`}
      >
        <button
          aria-label={t('send')}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-kallo-btn text-white transition-colors hover:bg-kallo-btn-hover active:scale-95 disabled:opacity-50"
          disabled={createReply.isPending || !hasDraft}
          tabIndex={hasDraft ? undefined : -1}
          type="submit"
        >
          <ArrowUp className="size-4" />
        </button>
      </span>
    </form>
  );
}
