import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/core/ui/cn';

/**
 * Words on the landing that open the page explaining them in more detail, with
 * the hero's "Try it on the web" treatment: underlined on hover, and an arrow
 * that steps right.
 */
export function MoreLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-text/40',
        className
      )}
    >
      <span className="underline-offset-4 group-hover:underline">
        {children}
      </span>
      <ArrowRight
        aria-hidden="true"
        className="ml-1 inline size-[0.8em] align-[-0.05em] transition-transform group-hover:translate-x-1"
      />
    </Link>
  );
}
