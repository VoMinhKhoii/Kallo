'use client';

import { ArrowUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { labelFor } from '@/components/groups/invite/profile-identity';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
import { useMyProfile } from '@/hooks/profile/use-profile';
import { useCreateReply } from '@/hooks/social/sharing/use-create-reply';

/**
 * The always-open reply field at the foot of a post's thread: a pill holding
 * your own avatar and a field addressed to the author ("Reply to Minh…"), with
 * the send button beside it. No toggle — a thread page you opened to read the
 * conversation is a page you came to answer, and a link that only reveals an
 * input is one tap of nothing.
 *
 * The avatar is IN the pill and the button is OUT of it (2026-09-22). The disc
 * used to sit outside the field with the word "Reply" out beyond it: the disc
 * read as a person standing next to a form rather than as the author of what
 * was being typed, and a verb in running type beside a field reads as a second
 * placeholder. Send is the app's own arrow-up affordance from the logging
 * composer, and it still appears only once there is something to send — which
 * is why it is the pill's sibling: a resting composer is then one unbroken
 * capsule across the page instead of one holding a permanent hole for a button
 * that is usually not there. Mirrors the Flutter dock in
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
      // No `gap-*` on the row: the gap belongs inside the morph, or a resting
      // pill stops 8px short of the edge for a button that is not there.
      className="flex w-full items-end"
    >
      {/* The pill paints the box, so the input inside it must not: hence
          `border-none bg-transparent` on the field. `focus-within` moves the
          focus ring out to the shell with the rest of the border. `p-[7px]`
          plus the 1px border is a uniform 8 from the stroke on all four sides
          — it was 6 on one side and 8 on the others, which shows on a 28px
          disc. */}
      <div
        className="flex min-w-0 flex-1 items-end gap-2 rounded-full border border-kallo-border bg-kallo-surface p-[7px] transition-colors focus-within:border-kallo-text"
        data-testid="reply-pill"
      >
        {/* size-7 (28), the replies' disc — what is being written here is a
            reply, not a post. It is also what sets the resting pill's height:
            28 + 2 × 8 = 44, which the input's `leading`/`py` below match. */}
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
          className="min-w-0 flex-1 border-none bg-transparent py-[3px] font-sans-display text-[15px] text-kallo-text leading-[22px] placeholder:text-kallo-text-muted focus:outline-none"
        />
      </div>
      {/* The morph: width, margin, opacity and scale from one transition, so
          the capsule shortens as the button arrives rather than the button
          popping into a row that has not made room for it. `hidden` would have
          no animation and `opacity-0` alone would leave a real button under
          the cursor with nothing to send, so the collapsed state is also
          `pointer-events-none`, `aria-hidden` and out of the tab order. */}
      <span
        aria-hidden={!hasDraft}
        className={`flex shrink-0 justify-end overflow-hidden transition-all duration-300 ease-out ${
          hasDraft
            ? 'ml-2 w-11 scale-100 opacity-100'
            : 'pointer-events-none ml-0 w-0 scale-85 opacity-0'
        }`}
      >
        {/* A 32px disc centred in a 44px target: the target matches the
            resting pill's height, so under `items-end` the disc lands on the
            pill's centre line rather than 6px below it. */}
        <span className="flex size-11 shrink-0 items-center justify-center">
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
      </span>
    </form>
  );
}
