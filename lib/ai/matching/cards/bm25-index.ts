/**
 * BM25 over the composition rows' English names. Call 1 writes the USDA-style
 * row name it expects (`tableName`, "Beef, brisket, flat half, cooked,
 * braised"); matching that against the tables' own vocabulary finds specific
 * rows plain similarity misses. k1 = 1.2, b = 0.75.
 */

const tokens = (s: string) =>
  (s ?? '').toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];

export interface Bm25Index {
  search(query: string, k?: number): string[];
}

export function buildBm25Index(
  docs: { id: string; text: string }[]
): Bm25Index {
  const n = docs.length;
  const lens = docs.map((d) => tokens(d.text).length);
  const avg = lens.reduce((a, b) => a + b, 0) / Math.max(1, n);
  const postings = new Map<string, { doc: number; tf: number }[]>();
  docs.forEach((d, i) => {
    const tf = new Map<string, number>();
    for (const w of tokens(d.text)) tf.set(w, (tf.get(w) ?? 0) + 1);
    for (const [w, f] of tf) {
      const list = postings.get(w);
      if (list) list.push({ doc: i, tf: f });
      else postings.set(w, [{ doc: i, tf: f }]);
    }
  });
  const idf = new Map<string, number>();
  for (const [w, list] of postings)
    idf.set(w, Math.log(1 + (n - list.length + 0.5) / (list.length + 0.5)));

  return {
    search(query, k = 30) {
      const scores = new Map<number, number>();
      for (const w of new Set(tokens(query))) {
        const list = postings.get(w);
        if (!list) continue;
        const wIdf = idf.get(w) ?? 0;
        for (const { doc, tf } of list) {
          const norm = tf + 1.2 * (0.25 + (0.75 * lens[doc]) / avg);
          scores.set(doc, (scores.get(doc) ?? 0) + (wIdf * tf * 2.2) / norm);
        }
      }
      return [...scores]
        .sort((a, b) => b[1] - a[1])
        .slice(0, k)
        .map(([doc]) => docs[doc].id);
    },
  };
}
