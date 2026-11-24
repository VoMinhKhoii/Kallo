/** Words in a meal's text that link to another page. */
export interface WordLink {
  words: string;
  href: string;
}

/** A run of text, linked when it has an `href`. */
export interface TextPart {
  text: string;
  href?: string;
}

/**
 * Where `words` first stands as whole words in `text` (case matters), or -1.
 * A letter, digit or hyphen on either side means it is part of a longer word:
 * "fried chicken" is not in "air-fried chicken", "miến" is not in "miếng".
 */
function wholeWordsAt(text: string, words: string): number {
  if (!words) return -1;
  const escaped = words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(
    `(?<![\\p{L}\\p{N}\\p{M}-])${escaped}(?![\\p{L}\\p{N}\\p{M}-])`,
    'u'
  ).exec(text);
  return match ? match.index : -1;
}

/**
 * Splits `text` into plain and linked runs: each link takes the first place
 * its words stand as whole words. A link whose words are missing, or overlap
 * an earlier link, is left out, so the text always reads the same.
 */
export function linkWords(
  text: string,
  links: readonly WordLink[]
): TextPart[] {
  const found = links
    .map((link) => ({ ...link, at: wholeWordsAt(text, link.words) }))
    .filter((link) => link.at >= 0)
    .sort((a, b) => a.at - b.at);
  const parts: TextPart[] = [];
  let from = 0;
  for (const { words, href, at } of found) {
    if (at < from) continue;
    if (at > from) parts.push({ text: text.slice(from, at) });
    parts.push({ text: words, href });
    from = at + words.length;
  }
  if (from < text.length) parts.push({ text: text.slice(from) });
  return parts;
}
