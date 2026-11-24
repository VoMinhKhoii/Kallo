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
 * Splits `text` into plain and linked runs: each link takes the first place
 * its words appear (case matters). A link whose words are missing, or overlap
 * an earlier link, is left out, so the text always reads the same.
 */
export function linkWords(
  text: string,
  links: readonly WordLink[]
): TextPart[] {
  const found = links
    .map((link) => ({ ...link, at: text.indexOf(link.words) }))
    .filter((link) => link.words && link.at >= 0)
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
