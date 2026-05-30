'use client';

import { Check, Link2, Loader2, Search, UserPlus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
import type { CircleMember, PublicProfile } from '@/lib/groups/client';
import { HANDLE_MIN_LENGTH } from '@/lib/groups/handles';

interface AddFriendDialogProps {
  /** The control that opens the dialog (e.g. a button). */
  trigger: ReactNode;
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

function SearchSection() {
  const t = useTranslations('groups.addFriend');
  const [query, setQuery] = useState('');
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

export function AddFriendDialog({ trigger }: AddFriendDialogProps) {
  const t = useTranslations('groups.addFriend');

  const handleCopyLink = async () => {
    try {
      const link = `${window.location.origin}/`;
      await navigator.clipboard.writeText(link);
      toast.success(t('linkCopied'));
    } catch {
      toast.error(t('linkCopyError'));
    }
  };

  return (
    <Dialog>
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

        <SearchSection />

        <button
          type="button"
          onClick={handleCopyLink}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-nham-border/60 bg-white px-3 py-2.5 font-medium text-[13px] text-nham-text-muted transition-colors hover:border-nham-accent/50 hover:text-nham-text"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          <Link2 className="h-4 w-4" />
          {t('copyLink')}
        </button>

        <div className="max-h-[40vh] overflow-y-auto">
          <RequestsAndCircle />
        </div>
      </DialogContent>
    </Dialog>
  );
}
