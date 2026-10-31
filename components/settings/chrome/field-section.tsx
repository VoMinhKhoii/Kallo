import type { ReactNode } from 'react';

/**
 * A titled run of FieldRows with no card around it: a small muted heading,
 * then the rows split by hairlines.
 */
export function FieldSection({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-1 font-medium text-[13px] text-kallo-text-muted">
        {title}
      </h3>
      <div className="divide-y divide-kallo-border">{children}</div>
    </section>
  );
}
