import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/navigation';
import { TOOL_COPY } from '@/lib/seo/tools/content';
import { type ToolSlug, toolPath } from '@/lib/seo/tools/slugs';

/** Calculator pages as a list of links with a one-line blurb each. */
export function ToolLinkList({
  locale,
  slugs,
}: {
  locale: Locale;
  slugs: readonly ToolSlug[];
}) {
  return (
    <ul className="mt-5 divide-y divide-kallo-border/60 border-kallo-border/60 border-y">
      {slugs.map((slug) => {
        const copy = TOOL_COPY[locale][slug];
        return (
          <li key={slug}>
            <Link
              className="block py-3 font-sans-display text-base text-kallo-text transition-colors hover:text-kallo-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent"
              href={toolPath(slug)}
            >
              <span>{copy.name}</span>
              <span className="mt-0.5 block text-kallo-text-muted text-sm">
                {copy.blurb}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
