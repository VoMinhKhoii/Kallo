'use client';

import type { CircleMember } from '@/lib/actions/groups/types';
import { cn } from '@/lib/ui/cn';
import { labelFor, ProfileIdentity } from './profile-identity';

/**
 * A Messenger-style selectable friend row for the group-creation picker:
 * a flat hairline-divided button with a filled radio circle on the right.
 */
export function GroupMemberRow({
  member,
  isSelected,
  onToggle,
}: {
  member: CircleMember;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={isSelected}
        aria-label={labelFor(member.profile)}
        className="flex w-full items-center gap-3 rounded border-[#E8E6DC] border-b py-2.5 text-left transition-colors last:border-b-0 hover:bg-[#141413]/[0.03]"
      >
        <ProfileIdentity profile={member.profile} />
        <span
          className={cn(
            'ml-auto flex size-[22px] shrink-0 items-center justify-center rounded-full border-2',
            isSelected ? 'border-[#141413] bg-[#141413]' : 'border-[#E8E6DC]'
          )}
        >
          {isSelected && <span className="size-2.5 rounded-full bg-white" />}
        </span>
      </button>
    </li>
  );
}
