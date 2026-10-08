/**
 * In-memory trigram index over every short name a card has (row names, card
 * food, EN aliases, VI names). Replaces the per-row `word_similarity` SQL arm
 * (~1 s per ingredient on the dev DB) at ~3 ms per query with equal recall@6
 * on the matching gate (2026-10-08).
 *
 * Score per name = max(trigram Jaccard, share of the query's trigrams the name
 * contains); a row scores its best name, ties go to the shorter name.
 * Diacritics are load-bearing (AGENTS.md §7): a query with diacritics matches
 * names as written; only an ASCII-only query matches unaccented names.
 */

import { fold } from '@/lib/core/text/fold';

/**
 * Lower-cased NFC word tokens; shared with the BM25 index. NFC first, so a
 * decomposed "bơ" is one token, not "bo" plus a stray combining mark.
 */
export function wordTokens(text: string): string[] {
  return (
    (text ?? '')
      .normalize('NFC')
      .toLowerCase()
      .match(/[\p{L}\p{N}_]+/gu) ?? []
  );
}

/** True when folding diacritics would not change the query (ASCII-only). */
const hasNoDiacritics = (query: string) =>
  fold(query) === query.normalize('NFC').toLowerCase().trim();

function trigrams(t: string): Set<string> {
  const out = new Set<string>();
  for (const w of wordTokens(t)) {
    const p = `  ${w} `;
    for (let i = 0; i < p.length - 2; i++) out.add(p.slice(i, i + 3));
  }
  return out;
}

interface Side {
  strs: { row: string; len: number; size: number }[];
  inv: Map<string, number[]>;
  hits: Uint16Array;
}

function buildSide(names: Map<string, Set<string>>, ascii: boolean): Side {
  const strs: Side['strs'] = [];
  const inv = new Map<string, number[]>();
  for (const [row, ns] of names)
    for (const n of ns) {
      const t = trigrams(ascii ? fold(n) : n);
      const i = strs.push({ row, len: n.length, size: t.size }) - 1;
      for (const g of t) {
        const list = inv.get(g);
        if (list) list.push(i);
        else inv.set(g, [i]);
      }
    }
  return { strs, inv, hits: new Uint16Array(strs.length) };
}

export interface LexicalIndex {
  search(query: string, k?: number): string[];
}

/** `names`: row id → the names it can be found by. */
export function buildLexicalIndex(
  names: Map<string, Set<string>>
): LexicalIndex {
  const raw = buildSide(names, false);
  const ascii = buildSide(names, true);
  return {
    search(query, k = 30) {
      const side = hasNoDiacritics(query) ? ascii : raw;
      const tq = trigrams(query);
      if (tq.size === 0) return [];
      const touched: number[] = [];
      for (const g of tq) {
        const list = side.inv.get(g);
        if (list)
          for (const i of list) if (side.hits[i]++ === 0) touched.push(i);
      }
      const best = new Map<string, [number, number]>();
      for (const i of touched) {
        const shared = side.hits[i];
        side.hits[i] = 0;
        const s = side.strs[i];
        const score = Math.max(
          shared / (tq.size + s.size - shared),
          shared / tq.size
        );
        const b = best.get(s.row);
        if (!b || score > b[0] || (score === b[0] && s.len < b[1]))
          best.set(s.row, [score, s.len]);
      }
      return [...best]
        .sort((a, b) => b[1][0] - a[1][0] || a[1][1] - b[1][1])
        .slice(0, k)
        .map(([row]) => row);
    },
  };
}
