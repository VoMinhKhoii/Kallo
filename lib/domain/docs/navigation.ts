/**
 * The docs table of contents — the single source of truth for the sidebar,
 * breadcrumbs, the prev/next pager, the hub cards, `generateStaticParams`, and
 * the sitemap. Adding a page means adding it here and dropping the matching
 * `.mdx` into BOTH `content/docs/vi` and `content/docs/en`;
 * `navigation.test.ts` fails the build if either locale is missing.
 *
 * Slugs are English and identical across locales — only the prose is
 * translated. That keeps the locale switcher a pure prefix swap
 * (/vi/docs/logging/barcode ⇄ /en/docs/logging/barcode) with no slug map.
 */

export interface DocsSection {
  /** Stable key; resolves to a title via the `docs.sections` messages. */
  id: string;
  slugs: string[];
}

export const DOCS_SECTIONS: DocsSection[] = [
  {
    id: 'start',
    slugs: ['overview', 'quickstart', 'profile-and-targets'],
  },
  {
    id: 'logging',
    slugs: [
      'logging/describe-a-meal',
      'logging/cheat-mode',
      'logging/manual',
      'logging/barcode',
      'logging/relog',
    ],
  },
  {
    id: 'tracking',
    slugs: ['tracking/dashboard', 'tracking/weight', 'tracking/nutrition'],
  },
  {
    id: 'circle',
    slugs: [
      'circle/friends-and-feed',
      'circle/groups-and-chats',
      'circle/sharing-and-splits',
    ],
  },
  {
    id: 'account',
    slugs: ['account/settings', 'account/premium', 'account/your-data'],
  },
  {
    id: 'estimates',
    slugs: ['estimates/how-it-works', 'estimates/accuracy-and-limits'],
  },
  {
    id: 'legal',
    slugs: ['legal/terms', 'legal/privacy'],
  },
];

/** Every slug, in reading order — the order the pager walks. */
export const DOCS_SLUGS: string[] = DOCS_SECTIONS.flatMap(
  (section) => section.slugs
);

export function isKnownDocSlug(slug: string): boolean {
  return DOCS_SLUGS.includes(slug);
}

export function findSectionForSlug(slug: string): DocsSection | undefined {
  return DOCS_SECTIONS.find((section) => section.slugs.includes(slug));
}

export interface DocsNeighbours {
  previous?: string;
  next?: string;
}

/** Previous/next in flat reading order, crossing section boundaries. */
export function getNeighbours(slug: string): DocsNeighbours {
  const index = DOCS_SLUGS.indexOf(slug);
  if (index === -1) return {};

  return {
    previous: index > 0 ? DOCS_SLUGS[index - 1] : undefined,
    next: index < DOCS_SLUGS.length - 1 ? DOCS_SLUGS[index + 1] : undefined,
  };
}
