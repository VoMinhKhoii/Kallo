import { Check } from 'lucide-react';
import { labelFor } from '@/components/groups/invite/profile-identity';
import { ProfileAvatar } from '@/components/groups/profile-avatar';
import type { CircleMember } from '@/lib/groups/client';
import { cn } from '@/lib/utils';

interface FriendPickRowProps {
  member: CircleMember;
  selected: boolean;
  onToggle: (userId: string) => void;
}

export function FriendPickRow({
  member,
  selected,
  onToggle,
}: FriendPickRowProps) {
  const label = labelFor(member.profile);

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onToggle(member.profile.userId)}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors',
        selected ? 'bg-nham-accent/15' : 'hover:bg-nham-hover/40'
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <ProfileAvatar profile={member.profile} size="8" />
        <span className="truncate font-sans-display text-[14px] text-nham-text">
          {label}
        </span>
      </span>
      {selected && <Check className="h-4 w-4 shrink-0 text-nham-btn" />}
    </button>
  );
}
