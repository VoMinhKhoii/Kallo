import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Locale } from '@/i18n/config';
import {
  absolutiseLinks,
  parseFrontmatter,
  stripComponents,
  stripFrontmatter,
} from '@/lib/domain/docs/markdown/to-markdown';
import { isKnownDocSlug } from '@/lib/domain/docs/navigation';
import { SITE_URL } from '@/lib/seo/site';

/**
 * The `text/markdown` representation of one docs page.
 *
 * Reads the `.mdx` source rather than the compiled module for the same reason
 * `toc.ts` does: the compiled module is React elements, and rendering them back
 * to text would need a DOM. The source is already the prose — frontmatter
 * included, which is why this parses it here instead of calling
 * `loadFrontmatter` and pulling the MDX compiler in to read three strings.
 *
 * This is BUILD-TIME ONLY. `content/` is not copied into the standalone Docker
 * image (see the Dockerfile), so the route that calls this must be
 * `force-static` with `generateStaticParams` covering every slug — a runtime
 * call would ENOENT in production.
 */

const CONTENT_ROOT = path.join(process.cwd(), 'content', 'docs');

export async function renderDocMarkdown(
  locale: Locale,
  slug: string
): Promise<string | null> {
  if (!isKnownDocSlug(slug)) return null;

  let source: string;
  try {
    source = await readFile(
      path.join(CONTENT_ROOT, locale, `${slug}.mdx`),
      'utf8'
    );
  } catch {
    return null;
  }

  const frontmatter = parseFrontmatter(source);
  if (!frontmatter) return null;

  const body = stripComponents(
    absolutiseLinks(stripFrontmatter(source), { siteUrl: SITE_URL, locale })
  );

  const canonical = `${SITE_URL}/${locale}/docs/${slug}`;

  return [
    `# ${frontmatter.title}`,
    '',
    `> ${frontmatter.description}`,
    '',
    body,
    '',
    '---',
    '',
    `_Source: [${canonical}](${canonical}) · Last updated: ${frontmatter.lastUpdated} · Kallo docs index: [${SITE_URL}/llms.txt](${SITE_URL}/llms.txt)_`,
    '',
  ].join('\n');
}
