'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { CircleError } from '@/components/groups/circle-error';
import { Input } from '@/components/ui/input';
import { useCreateChatGroup } from '@/hooks/social/use-chat-groups';
import { useFriends } from '@/hooks/social/use-friends';
import type { CircleMember } from '@/lib/groups/client';
import { cn } from '@/lib/utils';
import { labelFor, ProfileIdentity } from './profile-identity';

const GROUP_NAME_MAX_LENGTH = 60;

/**
 * Group-creation form: name + a multi-select of the actor's accepted
 * friends — the only member source (no invite-link path for groups yet,
 * matching createChatGroup's backend contract).
 */
export function CreateGroupForm({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations('groups.createGroup');
  const { data: members = [], isError, isFetching, refetch } = useFriends();
  const createGroup = useCreateChatGroup();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (isError) {
    return (
      <CircleError onRetry={() => void refetch()} isRetrying={isFetching} />
    );
  }

  const friends = members.filter((m) => m.status === 'accepted');

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
        onError: () => toast.error(t('createError')),
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label
          htmlFor="group-name"
          className="px-1 font-medium font-sans-display text-[10px] text-nham-text-muted uppercase tracking-[0.08em]"
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
          className="border-nham-border/60 bg-white font-sans-display text-nham-text"
        />
      </div>

      <div className="space-y-1.5">
        <p className="flex items-center justify-between px-1 font-medium font-sans-display text-[10px] text-nham-text-muted uppercase tracking-[0.08em]">
          <span>{t('membersLabel')}</span>
          {selected.size > 0 && (
            <span>{t('membersCount', { count: selected.size })}</span>
          )}
        </p>

        {friends.length === 0 ? (
          <p className="px-1 py-2 font-sans-display text-[12px] text-nham-text-muted">
            {t('noFriends')}
          </p>
        ) : (
          <ul className="max-h-[30vh] space-y-2 overflow-y-auto">
            {friends.map((member: CircleMember) => {
              const isSelected = selected.has(member.profile.userId);
              return (
                <li key={member.friendshipId}>
                  <button
                    type="button"
                    onClick={() => toggle(member.profile.userId)}
                    aria-pressed={isSelected}
                    aria-label={labelFor(member.profile)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors',
                      isSelected
                        ? 'border-nham-accent/50 bg-nham-accent/[0.06]'
                        : 'border-nham-border/60 bg-white hover:border-nham-accent/40'
                    )}
                  >
                    <ProfileIdentity profile={member.profile} />
                    <span
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-full border',
                        isSelected
                          ? 'border-nham-btn bg-nham-btn text-white'
                          : 'border-nham-border/70 bg-white'
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="inline-flex w-full items-center justify-center rounded-xl bg-nham-btn px-4 py-2.5 font-medium font-sans-display text-[13px] text-white shadow-nham-btn/20 shadow-sm transition-colors hover:bg-nham-btn/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {createGroup.isPending ? t('creating') : t('submit')}
      </button>
    </div>
  );
}
