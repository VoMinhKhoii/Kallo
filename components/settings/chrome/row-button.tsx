import type { ReactNode } from 'react';

interface RowButtonProps {
  pending: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}

/**
 * The soft, filled pill a settings row ends in (Export, Sign out): a quiet
 * secondary action that never competes with the one primary button.
 */
export function RowButton({
  pending,
  onClick,
  icon,
  children,
}: RowButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-busy={pending}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-kallo-segment px-4 py-2 font-medium text-[13px] text-kallo-text transition-colors duration-150 hover:bg-kallo-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent disabled:opacity-60"
    >
      {icon}
      {children}
    </button>
  );
}
