import type { ReactNode } from 'react';
import { SECONDARY_BUTTON } from './controls';

interface RowButtonProps {
  pending: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}

/**
 * The secondary action a settings row ends in (Export, Sign out): a quiet
 * outlined button that never competes with the one primary button.
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
      className={SECONDARY_BUTTON}
    >
      {icon}
      {children}
    </button>
  );
}
