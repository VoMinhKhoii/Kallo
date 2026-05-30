'use client';

import { Check, Copy, Link2, Loader2, Search, UserPlus, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  useAcceptFriend,
  useBlockFriend,
  useFriendSearch,
  useFriends,
  useRequestFriend,
} from '@/hooks/use-friends';
import { useMyProfile, useSaveProfile } from '@/hooks/use-profile';
import { ApiError } from '@/lib/errors';
import type { CircleMember, PublicProfile } from '@/lib/groups/client';
import { HANDLE_MIN_LENGTH, validateHandle } from '@/lib/groups/handles';

interface AddFriendDialogProps {
  /** The control that opens the dialog (e.g. a button). */
  trigger: ReactNode;
  /** When set (arriving via an invite link ?add=handle), the dialog opens
   *  automatically with this handle pre-searched. */
  initialHandle?: string;
}

function initialFor(profile: PublicProfile): string {
  const source = profile.displayName?.trim() || profile.handle;
  return source.charAt(0).toUpperCase();
}

function HandleAvatar({ profile }: { profile: PublicProfile }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-nham-accent/40 to-nham-border/55 ring-1 ring-nham-accent/25">
      <span
        className="font-bold text-[13px] text-nham-btn"
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      >
        {initialFor(profile)}
      </span>
    </span>
  );
}

function ProfileIdentity({ profile }: { profile: PublicProfile }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <HandleAvatar profile={profile} />
      <div className="flex min-w-0 flex-col">
        {profile.displayName ? (
          <span
            className="truncate text-[14px] text-nham-text"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            {profile.displayName}
          </span>
        ) : null}
        <span
          className="truncate text-[12px] text-nham-text-muted"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          @{profile.handle}
        </span>
      </div>
    </div>
  );
}

function SearchSection({ initialQuery = '' }: { initialQuery?: string }) {
  const t = useTranslations('groups.addFriend');
  const [query, setQuery] = useState(initialQuery);
  const normalized = query.trim().toLowerCase();
  const { data: result, isFetching } = useFriendSearch(normalized);
  const requestFriend = useRequestFriend();

  const handleRequest = (userId: string) => {
    requestFriend.mutate(userId, {
      onError: () => toast.error(t('requestError')),
    });
  };

  const showNotFound =
    normalized.length >= HANDLE_MIN_LENGTH && !isFetching && result === null;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-nham-text-muted/70" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchLabel')}
          autoComplete="off"
          spellCheck={false}
          className="border-nham-border/60 bg-white pl-9 text-nham-text"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        />
        {isFetching ? (
          <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-nham-text-muted/60" />
        ) : null}
      </div>

      {result ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-nham-border/60 bg-white p-3">
          <ProfileIdentity profile={result} />
          <button
            type="button"
            onClick={() => handleRequest(result.userId)}
            disabled={requestFriend.isPending}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-nham-btn px-3 py-1.5 font-medium text-[12px] text-white transition-colors hover:bg-nham-btn/90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            {requestFriend.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UserPlus className="h-3.5 w-3.5" />
            )}
            {requestFriend.isPending ? t('requesting') : t('request')}
          </button>
        </div>
      ) : null}

      {showNotFound ? (
        <p
          aria-live="polite"
          className="px-1 text-[12px] text-nham-text-muted"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {t('notFound')}
        </p>
      ) : (
        <p
          className="px-1 text-[11px] text-nham-text-muted/70"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {t('hint')}
        </p>
      )}
    </div>
  );
}

function MemberRow({
  member,
  action,
}: {
  member: CircleMember;
  action?: ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-nham-border/60 bg-white p-3">
      <ProfileIdentity profile={member.profile} />
      {action ? (
        <div className="flex shrink-0 items-center gap-2">{action}</div>
      ) : null}
    </li>
  );
}

function MemberSection({
  title,
  members,
  renderAction,
}: {
  title: string;
  members: CircleMember[];
  renderAction?: (member: CircleMember) => ReactNode;
}) {
  if (members.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3
        className="px-1 font-medium text-[10px] text-nham-text-muted uppercase tracking-[0.08em]"
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      >
        {title}
      </h3>
      <ul className="space-y-2">
        {members.map((member) => (
          <MemberRow
            key={member.friendshipId}
            member={member}
            action={renderAction?.(member)}
          />
        ))}
      </ul>
    </section>
  );
}

function RequestsAndCircle() {
  const t = useTranslations('groups.addFriend');
  const { data: members = [] } = useFriends();
  const acceptFriend = useAcceptFriend();
  const blockFriend = useBlockFriend();

  const { incoming, outgoing, circle } = useMemo(() => {
    const inc: CircleMember[] = [];
    const out: CircleMember[] = [];
    const acc: CircleMember[] = [];
    for (const member of members) {
      if (member.status === 'accepted') {
        acc.push(member);
      } else if (
        member.status === 'pending' &&
        member.direction === 'incoming'
      ) {
        inc.push(member);
      } else if (
        member.status === 'pending' &&
        member.direction === 'outgoing'
      ) {
        out.push(member);
      }
    }
    return { incoming: inc, outgoing: out, circle: acc };
  }, [members]);

  const handleAccept = (friendshipId: string) => {
    acceptFriend.mutate(friendshipId, {
      onError: () => toast.error(t('acceptError')),
    });
  };

  const handleBlock = (targetUserId: string) => {
    blockFriend.mutate(targetUserId, {
      onError: () => toast.error(t('blockError')),
    });
  };

  return (
    <div className="space-y-4">
      <MemberSection
        title={t('incomingTitle')}
        members={incoming}
        renderAction={(member) => (
          <>
            <button
              type="button"
              onClick={() => handleAccept(member.friendshipId)}
              disabled={acceptFriend.isPending}
              className="inline-flex items-center gap-1 rounded-lg bg-nham-btn px-2.5 py-1.5 font-medium text-[12px] text-white transition-colors hover:bg-nham-btn/90 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              <Check className="h-3.5 w-3.5" />
              {t('accept')}
            </button>
            <button
              type="button"
              onClick={() => handleBlock(member.profile.userId)}
              disabled={blockFriend.isPending}
              aria-label={t('block')}
              className="inline-flex items-center justify-center rounded-lg border border-nham-border/60 p-1.5 text-nham-text-muted transition-colors hover:bg-nham-danger/10 hover:text-nham-danger disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      />

      <MemberSection
        title={t('outgoingTitle')}
        members={outgoing}
        renderAction={() => (
          <span
            className="text-[11px] text-nham-text-muted"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            {t('pendingOutgoing')}
          </span>
        )}
      />

      <MemberSection
        title={t('circleTitle')}
        members={circle}
        renderAction={(member) => (
          <button
            type="button"
            onClick={() => handleBlock(member.profile.userId)}
            disabled={blockFriend.isPending}
            className="inline-flex items-center gap-1 rounded-lg border border-nham-border/60 px-2.5 py-1.5 font-medium text-[12px] text-nham-text-muted transition-colors hover:bg-nham-danger/10 hover:text-nham-danger disabled:cursor-not-allowed disabled:opacity-60"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            {t('block')}
          </button>
        )}
      />
    </div>
  );
}

/**
 * Top of the dialog: claim your @handle if you don't have one yet (the
 * prerequisite for being findable / appearing in a friend's circle), otherwise
 * surface your shareable invite link as readable text plus a copy button.
 */
function InviteSection() {
  const t = useTranslations('groups.addFriend');
  const locale = useLocale();
  const { data: profile, isLoading } = useMyProfile();
  const saveProfile = useSaveProfile();
  const [handle, setHandle] = useState('');

  // Don't flash the claim form before we know whether a handle already exists.
  if (isLoading) {
    return (
      <div className="h-[76px] animate-pulse rounded-xl bg-nham-hover/50" />
    );
  }

  if (!profile) {
    const normalized = handle.trim().toLowerCase().replace(/^@+/, '');
    const validation =
      normalized.length === 0 ? null : validateHandle(normalized);
    const canSave = validation?.valid === true && !saveProfile.isPending;

    // Show the specific reason once they've typed enough to judge; stay quiet
    // while still below the minimum length.
    let issue = '';
    if (
      validation &&
      !validation.valid &&
      normalized.length >= HANDLE_MIN_LENGTH
    ) {
      issue =
        validation.error === 'reserved'
          ? t('handleReserved')
          : t('handleInvalid');
    }

    const submit = () => {
      if (!canSave) return;
      saveProfile.mutate(
        { handle: normalized },
        {
          onError: (error) => {
            const code = error instanceof ApiError ? error.code : null;
            toast.error(
              code === 'CONFLICT'
                ? t('handleTaken')
                : code === 'VALIDATION_FAILED'
                  ? t('handleInvalid')
                  : t('claimError')
            );
          },
        }
      );
    };

    return (
      <div className="space-y-2 rounded-xl border border-nham-accent/40 bg-nham-accent/[0.06] p-3">
        <p
          className="font-medium text-[13px] text-nham-text"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {t('claimTitle')}
        </p>
        <div className="flex items-stretch gap-2">
          <div className="relative flex-1">
            <span
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[14px] text-nham-text-muted"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              @
            </span>
            <Input
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder={t('claimPlaceholder')}
              aria-label={t('claimTitle')}
              aria-invalid={Boolean(issue)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={30}
              className="border-nham-border/60 bg-white pl-7 text-nham-text"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            />
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!canSave}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-nham-btn px-3.5 font-medium text-[12px] text-white transition-colors hover:bg-nham-btn/90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            {saveProfile.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            {saveProfile.isPending ? t('saving') : t('save')}
          </button>
        </div>
        <p
          aria-live="polite"
          className={`text-[11px] ${issue ? 'text-nham-danger' : 'text-nham-text-muted'}`}
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {issue || t('claimHint')}
        </p>
      </div>
    );
  }

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const inviteLink = `${origin}/${locale}/groups?add=${profile.handle}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success(t('linkCopied'));
    } catch {
      toast.error(t('linkCopyError'));
    }
  };

  return (
    <div className="space-y-1.5">
      <p
        className="flex items-center gap-1.5 px-1 font-medium text-[10px] text-nham-text-muted uppercase tracking-[0.08em]"
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      >
        <Link2 className="h-3.5 w-3.5" />
        {t('yourInvite')}
      </p>
      <div className="flex items-stretch gap-2">
        <Input
          readOnly
          value={inviteLink}
          onFocus={(event) => event.currentTarget.select()}
          aria-label={t('yourInvite')}
          className="flex-1 border-nham-border/60 bg-white text-[12px] text-nham-text-muted"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        />
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-nham-border/60 bg-white px-3.5 font-medium text-[12px] text-nham-text transition-colors hover:border-nham-accent/50"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          <Copy className="h-3.5 w-3.5" />
          {t('copy')}
        </button>
      </div>
    </div>
  );
}

export function AddFriendDialog({
  trigger,
  initialHandle,
}: AddFriendDialogProps) {
  const t = useTranslations('groups.addFriend');
  const [open, setOpen] = useState(Boolean(initialHandle));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="gap-5 border-nham-border/60 bg-nham-surface">
        <DialogHeader>
          <DialogTitle
            className="text-nham-text text-xl"
            style={{ fontFamily: 'Lora, serif' }}
          >
            {t('title')}
          </DialogTitle>
          <DialogDescription
            className="text-nham-text-muted"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        <InviteSection />

        <SearchSection initialQuery={initialHandle} />

        <div className="max-h-[40vh] overflow-y-auto">
          <RequestsAndCircle />
        </div>
      </DialogContent>
    </Dialog>
  );
}
