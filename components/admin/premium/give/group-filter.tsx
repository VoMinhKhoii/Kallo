'use client';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/core/ui/cn';

export type GroupPlan = 'free' | 'complimentary' | 'not_paying';

export interface GroupValue {
  plan: GroupPlan;
  joinedFrom: string;
  joinedTo: string;
}

const PLANS: { value: GroupPlan; label: string }[] = [
  { value: 'free', label: 'On Free' },
  { value: 'complimentary', label: 'On free Premium' },
  { value: 'not_paying', label: 'Anyone not paying' },
];

/** A group by plan and, optionally, signup dates (inclusive, UTC). */
export function GroupFilter({
  value,
  onChange,
}: {
  value: GroupValue;
  onChange: (next: GroupValue) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Plan">
        {PLANS.map((plan) => (
          <button
            key={plan.value}
            type="button"
            aria-pressed={value.plan === plan.value}
            onClick={() => onChange({ ...value, plan: plan.value })}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm hover:bg-kallo-hover',
              value.plan === plan.value && 'bg-kallo-hover font-semibold'
            )}
          >
            {plan.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-sm">
          Signed up from
          <Input
            type="date"
            value={value.joinedFrom}
            onChange={(e) => onChange({ ...value, joinedFrom: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          to
          <Input
            type="date"
            value={value.joinedTo}
            onChange={(e) => onChange({ ...value, joinedTo: e.target.value })}
          />
        </label>
        <span className="pb-2 text-muted-foreground text-xs">
          Both optional. Paying accounts are always skipped.
        </span>
      </div>
    </div>
  );
}
