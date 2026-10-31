import type { ReactNode } from 'react';
import { cn } from '@/lib/core/ui/cn';

interface SettingsGroupProps {
  className?: string;
  children: ReactNode;
}

/**
 * A run of settings rows with no card around it, split by hairlines
 * (`divide-y`) the way Claude's settings are.
 */
export function SettingsGroup({ className, children }: SettingsGroupProps) {
  return (
    <section className={cn('divide-y divide-kallo-border', className)}>
      {children}
    </section>
  );
}

interface SettingsRowProps {
  label: ReactNode;
  /** Only for a consequence the user must know before acting. */
  description?: ReactNode;
  layout?: 'inline' | 'stacked';
  htmlFor?: string;
  className?: string;
  children?: ReactNode;
}

/**
 * One settings row: a 14px label on the left, the control on the right,
 * centred on one line at least 52px tall. Draws no border of its own — the
 * parent's `divide-y` does. A control too wide to sit beside the label wraps
 * under it; `stacked` always puts it in a full-width block below.
 */
export function SettingsRow({
  label,
  description,
  layout = 'inline',
  htmlFor,
  className,
  children,
}: SettingsRowProps) {
  const labelBlock = (
    <div className="min-w-0">
      {htmlFor ? (
        <label className="text-[14px] text-kallo-text" htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <p className="text-[14px] text-kallo-text">{label}</p>
      )}
      {description && (
        <p className="mt-0.5 max-w-prose text-[13px] text-kallo-text-muted">
          {description}
        </p>
      )}
    </div>
  );

  if (layout === 'stacked') {
    return (
      <div className={cn('py-3', className)}>
        {labelBlock}
        {children && <div className="mt-2">{children}</div>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex min-h-[52px] flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2.5',
        className
      )}
    >
      {labelBlock}
      {children}
    </div>
  );
}
