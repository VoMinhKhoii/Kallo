import type { ReactNode } from 'react';

/**
 * One row of a FieldSection: the label (and an optional description) on the
 * left, the control on the right. Draws no border; the section's divide-y
 * does. A control too wide to sit beside the label wraps below it.
 */
export function FieldRow({
  label,
  description,
  children,
}: {
  label: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2.5">
      <div className="min-w-0">
        <p className="text-[15px] text-kallo-text">{label}</p>
        {description && (
          <p className="mt-0.5 text-[13px] text-kallo-text-muted">
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
