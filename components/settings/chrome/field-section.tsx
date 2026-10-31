import type { ReactNode } from 'react';

/**
 * A titled run of rows with no card around it: a 15px heading, then the rows
 * split by hairlines.
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
      <h3 className="mb-1 font-medium text-[15px] text-kallo-text">{title}</h3>
      <div className="divide-y divide-kallo-border">{children}</div>
    </section>
  );
}
