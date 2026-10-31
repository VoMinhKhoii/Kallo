import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * The head of the Subscriptions page, laid out like Claude's billing page:
 * a line icon, the plan's name over one muted line, and its one action on
 * the right. Notes about the plan (warnings) go underneath.
 */
export function PlanSummary({
  icon: Icon,
  name,
  subtitle,
  action,
  children,
}: {
  icon: LucideIcon;
  name: ReactNode;
  subtitle: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Icon
          aria-hidden="true"
          strokeWidth={1.25}
          className="size-10 shrink-0 text-kallo-text-muted"
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-[15px] text-kallo-text">{name}</p>
          <p className="mt-0.5 text-[14px] text-kallo-text-muted">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
