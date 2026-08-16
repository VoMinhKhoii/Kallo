import { Check } from 'lucide-react';
import { labelFor } from '@/components/groups/invite/profile-identity';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
import type { CircleMember } from '@/lib/actions/groups/types';
import { cn } from '@/lib/ui/cn';

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
        selected ? 'bg-kallo-hover' : 'hover:bg-kallo-hover/40'
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <ProfileAvatar
          avatarUrl={member.profile.avatarUrl}
          label={label}
          className="size-8"
        />
        <span className="truncate font-sans-display text-[14px] text-kallo-text">
          {label}
        </span>
      </span>
      {selected && <Check className="h-4 w-4 shrink-0 text-kallo-btn" />}
    </button>
  );
}
