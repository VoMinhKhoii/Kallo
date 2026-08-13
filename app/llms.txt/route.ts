import { getTranslations } from 'next-intl/server';
import { defaultLocale } from '@/i18n/config';
import { loadFrontmatter } from '@/lib/docs/loader';
import { DOCS_SECTIONS } from '@/lib/docs/navigation';
import { SITE_URL } from '@/lib/site';

/**
 * `/llms.txt` — the docs index in the shape an LLM can actually use.
 *
 * A crawler that lands on the rendered docs has to strip a sidebar, a pager and
 * a breadcrumb trail off every page to find the prose. This serves the same
 * table of contents as a flat, link-per-line Markdown file, which is what the
 * llmstxt.org convention asks for and what assistants ingesting a product's
 * docs look for first.
 *
 * Built from `DOCS_SECTIONS` and each page's frontmatter — the same two sources
 * the sidebar and the sitemap read — so a new doc cannot appear in the nav and
 * be missing here. English only: it is one file at a fixed path, and the `en`
 * tree is complete by construction (`navigation.test.ts` fails the build if a
 * locale is missing a page). The Vietnamese tree is linked at the bottom.
 */
export const dynamic = 'force-static';

export async function GET(): Promise<Response> {
  const t = await getTranslations({
    locale: defaultLocale,
    namespace: 'metadata.root',
  });
  const sectionTitles = await getTranslations({
    locale: defaultLocale,
    namespace: 'docs.sections',
  });

  const lines: string[] = [
    '# Kallo',
    '',
    `> ${t('description')}`,
    '',
    'Kallo logs a meal from the sentence you would say out loud — "bún bò Huế,',
    'big bowl, no giò" — instead of a search box and a row of database matches.',
    'It is built for Vietnamese food, where the portion, not the ingredient, is',
    'the hard part of the estimate.',
    '',
  ];

  for (const section of DOCS_SECTIONS) {
    const entries: string[] = [];

    for (const slug of section.slugs) {
      const frontmatter = await loadFrontmatter(defaultLocale, slug);
      if (!frontmatter) continue;

      const url = `${SITE_URL}/${defaultLocale}/docs/${slug}`;
      entries.push(
        `- [${frontmatter.title}](${url}): ${frontmatter.description}`
      );
    }

    if (entries.length === 0) continue;

    lines.push(`## ${sectionTitles(section.id)}`, '', ...entries, '');
  }

  lines.push(
    '## Other languages',
    '',
    `- [Tiếng Việt](${SITE_URL}/vi): the same site and the same docs tree, with`,
    '  `/vi/` in place of `/en/` on every path above.',
    ''
  );

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}
