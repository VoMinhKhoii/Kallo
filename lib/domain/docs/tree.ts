import type { Locale } from '@/i18n/config';
import { loadFrontmatter } from '@/lib/domain/docs/loader';
import { DOCS_SECTIONS, DOCS_SLUGS } from '@/lib/domain/docs/navigation';

/**
 * Resolves the navigation tree for one locale — slugs paired with the titles
 * their MDX frontmatter declares.
 *
 * Titles live in frontmatter rather than in `messages/*.json` so a page's name
 * and its content can never drift apart: one file owns both. The section
 * headings above them are the only docs labels that live in the message
 * catalogs, because they have no file of their own.
 *
 * Runs at build time — every docs route is prerendered by
 * `generateStaticParams`.
 */

export interface DocsNavLink {
  slug: string;
  title: string;
}

export interface DocsNavSection {
  id: string;
  links: DocsNavLink[];
}

async function toLink(
  locale: Locale,
  slug: string
): Promise<DocsNavLink | null> {
  const frontmatter = await loadFrontmatter(locale, slug);
  if (!frontmatter) return null;

  return { slug, title: frontmatter.title };
}

export async function getDocsTree(locale: Locale): Promise<DocsNavSection[]> {
  const sections = await Promise.all(
    DOCS_SECTIONS.map(async (section) => {
      const links = await Promise.all(
        section.slugs.map((slug) => toLink(locale, slug))
      );

      return { id: section.id, links: links.filter((l) => l !== null) };
    })
  );

  return sections.filter((section) => section.links.length > 0);
}

/** Flat, in reading order — what the pager and the search index walk. */
export async function getDocsLinks(locale: Locale): Promise<DocsNavLink[]> {
  const links = await Promise.all(
    DOCS_SLUGS.map((slug) => toLink(locale, slug))
  );

  return links.filter((link) => link !== null);
}
