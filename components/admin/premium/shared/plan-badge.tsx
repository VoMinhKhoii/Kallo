import type { AccountPlan } from '@/lib/admin/premium/targets/plan-sql';
import { cn } from '@/lib/core/ui/cn';
import { formatDay } from './format';

const STYLES: Record<AccountPlan, string> = {
  paying: 'bg-kallo-success/15 text-kallo-text',
  complimentary: 'bg-kallo-accent/20 text-kallo-text',
  free: 'bg-kallo-track text-kallo-text-muted',
};

export function PlanBadge({
  plan,
  freeUntil,
}: {
  plan: AccountPlan;
  freeUntil?: Date | string | null;
}) {
  const label =
    plan === 'paying'
      ? 'Paying'
      : plan === 'complimentary'
        ? `Free Premium · to ${formatDay(freeUntil ?? null)}`
        : 'Free';
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 font-medium text-xs',
        STYLES[plan]
      )}
    >
      {label}
    </span>
  );
}
