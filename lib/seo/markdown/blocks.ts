import { SITE_URL } from '@/lib/seo/site';

/**
 * The few Markdown shapes every page renderer in this folder writes. Links are
 * absolute: an agent that fetched one page as Markdown has no base URL to
 * resolve a relative one against.
 */

/** An absolute URL for a locale-relative path: `/calories/pho` → `https://…/en/calories/pho`. */
export function pageUrl(locale: string, path: string): string {
  return `${SITE_URL}/${locale}${path}`;
}

/** A link; brackets and backslashes in its text are escaped so they cannot close it early. */
export function link(text: string, url: string): string {
  return `[${text.replace(/[\\[\]]/g, '\\$&')}](${url})`;
}

/** A sentence wrapped around one link, the way the pages write them. */
export function linkedSentence(
  parts: { before: string; after: string },
  text: string,
  url: string
): string {
  return `${parts.before}${link(text, url)}${parts.after}`;
}

export function bullets(items: string[]): string[] {
  return items.map((item) => `- ${item}`);
}

/**
 * A cell may not hold a line break or an unescaped pipe. Backslashes are
 * escaped first, so a cell ending in `\` cannot turn the pipe's escape into
 * an escaped backslash and a live column break.
 */
export function cell(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\s*\n\s*/g, ' ');
}

/** A GitHub-flavoured table; `numeric` columns are right-aligned. */
export function table(
  heads: string[],
  rows: string[][],
  numeric: number[] = []
): string[] {
  const rule = heads.map((_, i) => (numeric.includes(i) ? '---:' : '---'));
  const line = (cells: string[]) => `| ${cells.map(cell).join(' | ')} |`;
  return [line(heads), `| ${rule.join(' | ')} |`, ...rows.map(line)];
}

/** Paragraphs, each followed by a blank line. */
export function paragraphs(texts: string[]): string[] {
  return texts.flatMap((text) => [text, '']);
}
