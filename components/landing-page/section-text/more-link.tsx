import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/core/ui/cn';

/**
 * Words on the landing that open the page explaining them in more detail, with
 * the hero's "Try it on the web" treatment: underlined on hover, and an arrow
 * at the end that steps right.
 *
 * The last word and the arrow never wrap apart, so the arrow cannot end up
 * alone on a line. `lead` is an optional bold opening, as in card captions.
 * With `stretch` the link covers its nearest positioned ancestor, so the whole
 * demo card is the target and hovering anywhere on it moves the arrow.
 */
export function MoreLink({
  href,
  lead,
  text,
  stretch = false,
  className,
}: {
  href: string;
  lead?: string;
  text: string;
  stretch?: boolean;
  className?: string;
}) {
  const cut = text.lastIndexOf(' ') + 1;
  return (
    <Link
      href={href}
      className={cn(
        'group rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-text/40',
        stretch && 'after:absolute after:inset-0',
        className
      )}
    >
      <span className="decoration-1 underline-offset-4 group-hover:underline">
        {lead && <span className="font-semibold">{lead} </span>}
        {text.slice(0, cut)}
        <span className="whitespace-nowrap">
          {text.slice(cut)}
          <ArrowRight
            aria-hidden="true"
            className="ml-1 inline size-[0.8em] align-[-0.05em] transition-transform group-hover:translate-x-1"
          />
        </span>
      </span>
    </Link>
  );
}
