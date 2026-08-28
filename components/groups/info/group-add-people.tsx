'use client';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { PremiumChip } from '@/components/billing/premium-chip';
import { usePremiumGuard } from '@/components/billing/premium-guard-provider';
import { GroupMemberRow } from '@/components/groups/invite/group-member-row';
import { labelFor } from '@/components/groups/invite/profile-identity';
import { Input } from '@/components/ui/input';
import { useAddGroupMembers } from '@/hooks/social/circle/use-chat-groups';
import { useFriends } from '@/hooks/social/circle/use-friends';
import type { ChatGroupDetail } from '@/lib/actions/chat-groups/types';
import { ApiError } from '@/lib/core/errors/client';

/** Grow the group from the actor's accepted friends — same Messenger-style
 * picker as creation, scoped to friends not already in the group. */
export function GroupAddPeople({ group }: { group: ChatGroupDetail }) {
  const t = useTranslations('groups.info');
  const tLimit = useTranslations('groups.circleLimit');
  const { data: members = [] } = useFriends();
  const addMembers = useAddGroupMembers(group.id);
  const { locked, requirePremium } = usePremiumGuard();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const memberIds = new Set(group.members.map((member) => member.userId));
  const candidates = members.filter(
    (m) => m.status === 'accepted' && !memberIds.has(m.profile.userId)
  );
  const filtered = candidates.filter((m) =>
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

  const submit = () => {
    if (selected.size === 0 || addMembers.isPending) return;
    if (!requirePremium('unlimited_circle')) return;
    addMembers.mutate([...selected], {
      onSuccess: () => {
        toast.success(t('added'));
        setSelected(new Set());
        setQuery('');
      },
      // A group cap can belong to the person being ADDED, not the actor — that
      // comes back as a 409. Its server message is Vietnamese by contract (the
      // API and mobile clients depend on it), so translate here rather than
      // surfacing raw copy to an English reader. (A 402 for the actor's own
      // lock is pre-empted above.)
      onError: (error) =>
        toast.error(
          error instanceof ApiError && error.code === 'CIRCLE_LIMIT_REACHED'
            ? tLimit('memberAtLimit')
            : t('addError')
        ),
    });
  };

  if (candidates.length === 0) {
    return (
      <p className="px-1.5 font-sans-display text-[#6E6D66] text-[12px]">
        {t('everyoneIn')}
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
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

      {filtered.length === 0 ? (
        <p className="px-1.5 py-1 font-sans-display text-[#6E6D66] text-[12px]">
          {t('noMatches')}
        </p>
      ) : (
        <ul className="max-h-[32vh] overflow-y-auto">
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

      {selected.size > 0 && (
        <button
          type="button"
          onClick={submit}
          disabled={addMembers.isPending}
          className="inline-flex w-full items-center justify-center rounded-xl bg-kallo-btn px-4 py-2 font-medium font-sans-display text-[13px] text-white transition-colors hover:bg-kallo-btn/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('addCta')} · {selected.size}
          {locked('unlimited_circle') && <PremiumChip className="ml-2" />}
        </button>
      )}
    </div>
  );
}
