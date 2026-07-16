import { Check } from 'lucide-react';
import { labelFor } from '@/components/groups/invite/profile-identity';
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
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-nham-accent/40 to-nham-border/50 ring-1 ring-nham-accent/25">
          <span className="font-bold font-sans-display text-[12px] text-nham-btn">
            {label.charAt(0).toUpperCase()}
          </span>
        </span>
        <span className="truncate font-sans-display text-[14px] text-nham-text">
          {label}
        </span>
      </span>
      {selected && <Check className="h-4 w-4 shrink-0 text-nham-btn" />}
    </button>
  );
}
