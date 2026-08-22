import type { Locale } from '@/i18n/config';
import { loadFrontmatter } from '@/lib/domain/docs/loader';
import { DOCS_SECTIONS } from '@/lib/domain/docs/navigation';
import { getToc } from '@/lib/domain/docs/toc';

/**
 * Build-time index behind the ⌘K palette.
 *
 * One entry per page, not per heading: heading text is folded into `keywords`
 * so a reader searching "vật chứa" still finds the logging page, without the
 * result list exploding into a hundred near-identical rows. cmdk matches
 * against the title, the description and those keywords together.
 */

export interface DocsSearchEntry {
  slug: string;
  title: string;
  description: string;
  sectionId: string;
  /** Heading text from the page, for matching only — never displayed. */
  keywords: string[];
}

export async function getSearchIndex(
  locale: Locale
): Promise<DocsSearchEntry[]> {
  const perSection = await Promise.all(
    DOCS_SECTIONS.map(async (section) =>
      Promise.all(
        section.slugs.map(async (slug) => {
          const frontmatter = await loadFrontmatter(locale, slug);
          if (!frontmatter) return null;

          const toc = await getToc(locale, slug);

          return {
            slug,
            title: frontmatter.title,
            description: frontmatter.description,
            sectionId: section.id,
            keywords: toc.map((entry) => entry.text),
          };
        })
      )
    )
  );

  return perSection.flat().filter((entry) => entry !== null);
}
