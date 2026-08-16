import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SettingsGroupProps {
  id?: string;
  variant?: 'default' | 'danger';
  className?: string;
  children: ReactNode;
}

/**
 * Grouped list container in the Apple-Settings idiom: one white card whose rows
 * are separated by hairlines (`divide-y`), never nested cards. Danger groups
 * swap the border to the terracotta `kallo-danger` concern register.
 */
export function SettingsGroup({
  id,
  variant = 'default',
  className,
  children,
}: SettingsGroupProps) {
  return (
    <section
      id={id}
      className={cn(
        'divide-y divide-kallo-border rounded-2xl border bg-white shadow-xs',
        variant === 'danger' ? 'border-kallo-danger/40' : 'border-kallo-border',
        id && 'scroll-mt-20',
        className
      )}
    >
      {children}
    </section>
  );
}

interface SettingsRowProps {
  label: ReactNode;
  description?: ReactNode;
  layout?: 'inline' | 'stacked';
  htmlFor?: string;
  className?: string;
  children?: ReactNode;
}

/**
 * A single row inside a SettingsGroup. Draws no border of its own — the parent
 * group's `divide-y` supplies the hairlines. `inline` places the control
 * trailing the label; `stacked` drops it into a full-width block below.
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
        <label className="text-[15px] text-kallo-text" htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <p className="text-[15px] text-kallo-text">{label}</p>
      )}
      {description && (
        <p className="mt-0.5 text-[13px] text-kallo-text-muted">
          {description}
        </p>
      )}
    </div>
  );

  if (layout === 'stacked') {
    return (
      <div className={cn('p-card-sm', className)}>
        {labelBlock}
        {children && <div className="mt-3">{children}</div>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-card-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4',
        className
      )}
    >
      {labelBlock}
      {children}
    </div>
  );
}
