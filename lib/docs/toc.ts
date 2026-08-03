import { readFile } from 'node:fs/promises';
import path from 'node:path';
import GithubSlugger from 'github-slugger';
import type { Locale } from '@/i18n/config';

export interface TocEntry {
  id: string;
  text: string;
  depth: 2 | 3;
}

const CONTENT_ROOT = path.join(process.cwd(), 'content', 'docs');

// ATX headings only (`## …`), which is all the docs use. The leading-space
// bound of 0–3 matches CommonMark; 4+ spaces is an indented code block.
const HEADING = /^ {0,3}(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/;
// Fenced blocks must be skipped or a commented-out `#` inside one becomes a
// phantom TOC row.
const FENCE = /^ {0,3}(```|~~~)/;

/** Strip the inline markdown that can appear inside a heading. */
function toPlainText(markdown: string): string {
  return markdown
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .trim();
}

/**
 * Build the "on this page" rail for one doc.
 *
 * IDs are generated with `github-slugger` — the very library `rehype-slug`
 * uses — and every heading level advances the slugger even though only h2/h3
 * are returned, so the duplicate-suffix counters (`…-1`, `…-2`) stay in lockstep
 * with the ids actually rendered into the HTML. Vietnamese diacritics survive
 * slugging, so `## Ước tính` and `## Ước lượng` stay distinct.
 *
 * Reads the source file rather than the compiled module: every docs page is
 * prerendered by `generateStaticParams`, so this runs at build time only.
 */
export async function getToc(
  locale: Locale,
  slug: string
): Promise<TocEntry[]> {
  const filePath = path.join(CONTENT_ROOT, locale, `${slug}.mdx`);

  let source: string;
  try {
    source = await readFile(filePath, 'utf8');
  } catch {
    return [];
  }

  const slugger = new GithubSlugger();
  const entries: TocEntry[] = [];
  let inFence = false;
  let inFrontmatter = false;

  const lines = source.split('\n');

  for (const [index, line] of lines.entries()) {
    // Frontmatter is only frontmatter when it opens on line 1.
    if (line.trim() === '---') {
      if (index === 0) {
        inFrontmatter = true;
        continue;
      }
      if (inFrontmatter) {
        inFrontmatter = false;
        continue;
      }
    }
    if (inFrontmatter) continue;

    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = HEADING.exec(line);
    if (!match) continue;

    const depth = match[1].length;
    const text = toPlainText(match[2]);
    if (!text) continue;

    // Advance the slugger for every heading, mirroring rehype-slug.
    const id = slugger.slug(text);

    if (depth === 2 || depth === 3) {
      entries.push({ id, text, depth });
    }
  }

  return entries;
}
