'use client';

import { cn } from '@/lib/core/ui/cn';
import { AccountPicker, type PickedAccount } from './account-picker';
import { GroupFilter, type GroupValue } from './group-filter';

export type WhoKind = 'users' | 'group' | 'everyone';

export interface WhoValue {
  kind: WhoKind;
  picked: PickedAccount[];
  group: GroupValue;
}

const KINDS: { value: WhoKind; title: string; hint: string }[] = [
  {
    value: 'users',
    title: 'Specific accounts',
    hint: 'Search by name or email',
  },
  { value: 'group', title: 'A group', hint: 'Pick by plan and signup date' },
  {
    value: 'everyone',
    title: 'Everyone',
    hint: 'Every account, paying ones skipped',
  },
];

export function WhoPicker({
  value,
  onChange,
}: {
  value: WhoValue;
  onChange: (next: WhoValue) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 font-medium text-sm">Who</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        {KINDS.map((kind) => (
          <button
            key={kind.value}
            type="button"
            aria-pressed={value.kind === kind.value}
            onClick={() => onChange({ ...value, kind: kind.value })}
            className={cn(
              'rounded-xl border px-4 py-3 text-left hover:bg-kallo-hover',
              value.kind === kind.value && 'border-kallo-btn bg-kallo-hover'
            )}
          >
            <span className="block font-semibold text-sm">{kind.title}</span>
            <span className="block text-muted-foreground text-xs">
              {kind.hint}
            </span>
          </button>
        ))}
      </div>
      {value.kind === 'users' && (
        <AccountPicker
          picked={value.picked}
          onChange={(picked) => onChange({ ...value, picked })}
        />
      )}
      {value.kind === 'group' && (
        <GroupFilter
          value={value.group}
          onChange={(group) => onChange({ ...value, group })}
        />
      )}
    </fieldset>
  );
}

/** The Who as the server actions take it. */
export function toWhoInput(value: WhoValue) {
  if (value.kind === 'users') {
    return { kind: 'users' as const, userIds: value.picked.map((p) => p.id) };
  }
  if (value.kind === 'group') {
    return {
      kind: 'group' as const,
      plan: value.group.plan,
      joinedFrom: value.group.joinedFrom || undefined,
      joinedTo: value.group.joinedTo || undefined,
    };
  }
  return { kind: 'everyone' as const };
}
