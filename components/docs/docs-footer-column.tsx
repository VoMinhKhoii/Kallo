import { Link } from '@/i18n/navigation';

/**
 * One titled list of links in the footer. The label is a `p`, not a heading: a
 * page's outline starts at its `h1`. The list stays named through
 * `aria-labelledby`.
 */
export function DocsFooterColumn({
  id,
  label,
  links,
}: {
  id: string;
  label: string;
  links: { href: string; title: string }[];
}) {
  return (
    <div>
      <p
        className="font-sans-display font-semibold text-base text-kallo-surface dark:text-kallo-text"
        id={`docs-footer-${id}`}
      >
        {label}
      </p>
      <ul aria-labelledby={`docs-footer-${id}`} className="mt-5 space-y-3.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              className="rounded-sm font-sans-display text-base text-kallo-stone transition-colors hover:text-kallo-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent dark:hover:text-kallo-text"
              href={link.href}
            >
              {link.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
