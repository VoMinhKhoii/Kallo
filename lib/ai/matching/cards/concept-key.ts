/**
 * Concept key — rows that differ only by grade, salt, enrichment or
 * fortification (USDA's "choice / select", "with / without salt", ...) are one
 * concept for retrieval: Call 2 sees one representative, so siblings do not
 * crowd the candidate list. Pure function of the row, so a new source needs no
 * extra data.
 */

const DROP = [
  /\b(choice|select|prime|all grades)\b/g,
  /\bwith(out)? (added )?salt\b/g,
  /\b(un)?enriched\b/g,
  /\bwith(out)? added vitamin [a-z0-9 and]+\b/g,
  /\b(vitamin|calcium|mineral)[a-z0-9 ,]* fortified\b/g,
  /\bfortified\b/g,
  /\(includes foods for usda.?s food distribution program\)/g,
  /\bno salt added\b/g,
  /\blow sodium\b/g,
  /\bwith calcium propionate\b/g,
  /\bwithout calcium propionate\b/g,
];

/**
 * The salt variant a text names, for picking between concept siblings that
 * differ only by salt (see DROP): "without" for unsalted / no salt added /
 * low sodium / không muối, "with" for salted / có muối, else null. Checked in
 * that order because "unsalted" contains "salted".
 */
export function saltVariant(text: string): 'with' | 'without' | null {
  const t = text.normalize('NFC').toLowerCase();
  if (
    /\b(unsalted|salt[- ]free|low[- ]sodium|no (added )?salt( added)?|without (added )?salt)\b/.test(
      t
    ) ||
    /không muối|ít muối|không thêm muối/.test(t)
  )
    return 'without';
  if (/\b(salted|with (added )?salt)\b/.test(t) || /có muối|rang muối/.test(t))
    return 'with';
  return null;
}

export function conceptKey(row: {
  sourceCode: string;
  state: string;
  nameEn: string | null;
  namePrimary: string;
}): string {
  let n = (row.nameEn || row.namePrimary).toLowerCase();
  for (const p of DROP) n = n.replace(p, ' ');
  n = n
    .replace(/\s*,\s*/g, ',')
    .replace(/,+/g, ',')
    .replace(/\s+/g, ' ')
    .replace(/^[ ,]+|[ ,]+$/g, '');
  return `${row.sourceCode}|${row.state}|${n}`;
}
