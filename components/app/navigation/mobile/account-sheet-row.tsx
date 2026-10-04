import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';

/** A grouped-list row in the account sheet; the sign-out button wears it too. */
export const ACCOUNT_ROW =
  'flex min-h-12 w-full items-center gap-3 px-4 text-left transition-colors active:bg-kallo-hover';

/** A destination row in the account sheet's grouped list. */
export function AccountSheetRow({
  href,
  icon,
  label,
  onNavigate,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  onNavigate: () => void;
}) {
  return (
    <li>
      <Link href={href} onClick={onNavigate} className={ACCOUNT_ROW}>
        <span className="text-kallo-text-muted">{icon}</span>
        <span className="flex-1 font-medium text-[15px] text-kallo-text">
          {label}
        </span>
        <ChevronRight
          className="size-4 text-kallo-text-muted"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}
