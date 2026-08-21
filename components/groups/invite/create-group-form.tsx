'use client';

import { Search, Users2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { CircleError } from '@/components/groups/circle-error';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { useCreateChatGroup } from '@/hooks/social/circle/use-chat-groups';
import { useFriends } from '@/hooks/social/circle/use-friends';
import { ApiError } from '@/lib/core/errors/client';
import { GroupMemberRow } from './group-member-row';
import { labelFor } from './profile-identity';

const GROUP_NAME_MAX_LENGTH = 60;

/**
 * Group-creation form: name + a multi-select of the actor's accepted
 * friends — the only member source (no invite-link path for groups yet,
 * matching createChatGroup's backend contract).
 */
export function CreateGroupForm({
  onCreated,
  onAddFriend,
}: {
  onCreated: () => void;
  onAddFriend?: () => void;
}) {
  const t = useTranslations('groups.createGroup');
  const { data: members = [], isError, isFetching, refetch } = useFriends();
  const createGroup = useCreateChatGroup();
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (isError) {
    return (
      <CircleError onRetry={() => void refetch()} isRetrying={isFetching} />
    );
  }

  const friends = members.filter((m) => m.status === 'accepted');
  const filtered = friends.filter((m) =>
    labelFor(m.profile).toLowerCase().includes(query.trim().toLowerCase())
  );

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const canSubmit =
    name.trim().length > 0 && selected.size > 0 && !createGroup.isPending;

  const submit = () => {
    if (!canSubmit) return;
    createGroup.mutate(
      { name: name.trim(), memberUserIds: [...selected] },
      {
        onSuccess: () => {
          toast.success(t('created'));
          setName('');
          setSelected(new Set());
          onCreated();
        },
        // Backstop only — CircleAddMenu gates the entry point. A cap that
        // belongs to an invited member surfaces as a 409 naming them.
        onError: (error) =>
          toast.error(
            error instanceof ApiError && error.code === 'CIRCLE_LIMIT_REACHED'
              ? error.message
              : t('createError')
          ),
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label
          htmlFor="group-name"
          className="px-1 font-medium font-sans-display text-[#6E6D66] text-[10px] uppercase tracking-[0.08em]"
        >
          {t('nameLabel')}
        </label>
        <Input
          id="group-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('namePlaceholder')}
          maxLength={GROUP_NAME_MAX_LENGTH}
          autoComplete="off"
          className="border-[#E8E6DC] bg-white font-sans-display text-[#141413]"
        />
      </div>

      {friends.length === 0 ? (
        <EmptyState
          icon={Users2}
          title={t('emptyTitle')}
          description={t('noFriends')}
        >
          {onAddFriend && (
            <button
              type="button"
              onClick={onAddFriend}
              className="rounded-xl bg-kallo-btn px-3.5 py-2 font-medium font-sans-display text-[13px] text-white transition-colors hover:bg-kallo-btn/90"
            >
              {t('addFriendCta')}
            </button>
          )}
        </EmptyState>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#6E6D66]" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('searchPlaceholder')}
              autoComplete="off"
              className="border-[#E8E6DC] bg-white pl-9 font-sans-display text-[#141413]"
            />
          </div>

          <p className="flex items-center justify-between px-1 font-medium font-sans-display text-[#6E6D66] text-[10px] uppercase tracking-[0.08em]">
            <span>{t('suggested')}</span>
            {selected.size > 0 && (
              <span>{t('membersCount', { count: selected.size })}</span>
            )}
          </p>

          {filtered.length === 0 ? (
            <p className="px-1 py-2 font-sans-display text-[#6E6D66] text-[12px]">
              {t('noMatches')}
            </p>
          ) : (
            <ul className="max-h-[38vh] overflow-y-auto">
              {filtered.map((member) => (
                <GroupMemberRow
                  key={member.friendshipId}
                  member={member}
                  isSelected={selected.has(member.profile.userId)}
                  onToggle={() => toggle(member.profile.userId)}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="inline-flex w-full items-center justify-center rounded-xl bg-kallo-btn px-4 py-2.5 font-medium font-sans-display text-[13px] text-white transition-colors hover:bg-kallo-btn/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {createGroup.isPending ? t('creating') : t('submit')}
      </button>
    </div>
  );
}
