'use client';

import { ArrowUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { labelFor } from '@/components/groups/invite/profile-identity';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
import { useMyProfile } from '@/hooks/profile/use-profile';
import { useCreateReply } from '@/hooks/social/sharing/use-create-reply';
import { cn } from '@/lib/core/ui/cn';

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
 * placeholder. Send is the same arrow-up glyph the logging composer uses, at
 * this dock's own scale — not a shared component; if a fourth arrow-up button
 * appears, that is the moment to promote one. It still shows only once there
 * is something to send, which is why it is the pill's sibling: a resting
 * composer is then one unbroken capsule across the page instead of one holding
 * a permanent hole for a button that is usually not there. Mirrors the Flutter
 * dock in `apps/mobile-flutter/lib/features/circle/widgets/thread/`.
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
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const trimmed = body.trim();
    if (!trimmed || createReply.isPending) return;
    createReply.mutate(
      { shareId, body: trimmed },
      {
        onSuccess: () => {
          setBody('');
          // Back to the field. Clearing the draft collapses the send button,
          // and a focused button that becomes `disabled` drops focus to
          // <body> — so sending with the keyboard used to lose your place mid
          // conversation. It is also just what a chat composer does.
          inputRef.current?.focus();
        },
      }
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
      {/* `h-11` states the height rather than leaving it to emerge from the
          avatar plus padding plus border — the button beside it is `size-11`,
          and the two matching is the whole point. The pill paints the box, so
          the input inside it must not: hence `border-none bg-transparent`.
          `focus-within` moves the focus ring out to the shell with the rest of
          the border. */}
      <div
        className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-kallo-border bg-kallo-surface px-2 transition-colors focus-within:border-kallo-text"
        data-testid="reply-pill"
      >
        {/* size-7 (28), the replies' disc — what is being written here is a
            reply, not a post. */}
        <ProfileAvatar
          avatarUrl={profile?.avatarUrl ?? null}
          className="size-7"
          label={myLabel}
        />
        <input
          ref={inputRef}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={
            authorName
              ? t('replyTo', { name: authorName })
              : t('replyPlaceholder')
          }
          className="min-w-0 flex-1 border-none bg-transparent font-sans-display text-[15px] text-kallo-text placeholder:text-kallo-text-muted focus:outline-none"
        />
      </div>
      {/* The morph: width, margin, opacity and scale from one transition, so
          the capsule shortens as the button arrives rather than the button
          popping into a row that has not made room for it. `hidden` would have
          no animation and `opacity-0` alone would leave a real button under
          the cursor with nothing to send, so the collapsed state is also
          `pointer-events-none`, `aria-hidden` and out of the tab order. */}
      <span
        // `aria-hidden` is NOT redundant with `disabled`: a disabled button is
        // still in the accessibility tree and would be announced as a
        // permanent "send, unavailable" under an empty field. It is safe over
        // a focusable descendant only because `disabled` takes it out of the
        // tab order too.
        aria-hidden={!hasDraft}
        className={cn(
          'flex shrink-0 justify-end overflow-hidden transition-all duration-300 ease-out',
          hasDraft
            ? 'ml-2 w-11 scale-100 opacity-100'
            : 'pointer-events-none ml-0 w-0 scale-85 opacity-0'
        )}
      >
        {/* `size-11` matches the pill's `h-11`: the disc IS the target and
            stands exactly as tall as the field it sends, so it is larger than
            the 28px disc inside the pill. `ml-2` above is the same step as the
            pill's `px-2`, so field-to-button and disc-to-border read as one
            gap. `size-5` is a step under the nav 24 — mobile's `action` tier —
            because at 24 the arrow filled too much of the disc. */}
        <button
          aria-label={t('send')}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-kallo-btn text-white transition-colors hover:bg-kallo-btn-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent/30 active:scale-95 disabled:opacity-50"
          disabled={createReply.isPending || !hasDraft}
          type="submit"
        >
          <ArrowUp className="size-5" />
        </button>
      </span>
    </form>
  );
}
