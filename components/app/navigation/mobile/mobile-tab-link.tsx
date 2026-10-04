import type { LucideIcon } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/core/ui/cn';

interface MobileTabLinkProps {
  href: string;
  icon: LucideIcon;
  /** The tab's accessible name — the bar is icon-only, like Flutter's. */
  label: string;
  active: boolean;
  /** Ambient unread dot (pending invites on Circle). */
  badged: boolean;
}

/** One tab-bar destination: ink with a heavier stroke when active, muted
 *  otherwise, the whole flex slot as the target. */
export function MobileTabLink({
  href,
  icon: Icon,
  label,
  active,
  badged,
}: MobileTabLinkProps) {
  return (
    <li className="flex h-full flex-1">
      <Link
        href={href}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'relative flex h-full flex-1 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent',
          active ? 'text-kallo-text' : 'text-kallo-text-muted'
        )}
      >
        <span className="relative">
          <Icon
            className="size-6"
            strokeWidth={active ? 2 : 1.5}
            aria-hidden="true"
          />
          {badged && (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-kallo-accent ring-2 ring-white"
            />
          )}
        </span>
      </Link>
    </li>
  );
}
