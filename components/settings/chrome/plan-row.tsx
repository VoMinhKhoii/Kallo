import type { ReactNode } from 'react';
import { FormItem } from '@/components/ui/form';

/**
 * A control row inside the target card: a fixed-width label, then the
 * control filling the rest, stacked on a narrow page. Left-aligned (unlike
 * SettingsRow) so the card's three controls line up under one another.
 */
export function PlanRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <FormItem className="flex @lg:flex-row flex-col @lg:items-center @lg:gap-4 gap-2 py-3">
      <p className="@lg:w-20 shrink-0 text-[14px] text-kallo-text">{label}</p>
      <div className="min-w-0 flex-1">{children}</div>
    </FormItem>
  );
}
