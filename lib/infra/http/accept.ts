/**
 * RFC 9110 §12.5.1 `Accept` parsing, for markdown content negotiation.
 *
 * Written out rather than pulled from a package because the whole of it is
 * sixty lines and the two subtle rules — a more specific range overrides a
 * less specific one *regardless of q*, and `q=0` is an explicit rejection
 * rather than a low preference — are exactly the parts a wrong dependency
 * would get wrong silently.
 *
 * `text/html` leads `PRODUCES`: with no Accept header, or with `* / *`, the
 * first entry is what a client gets, and HTML is what a browser wants.
 */

export const MEDIA_HTML = 'text/html';
export const MEDIA_MARKDOWN = 'text/markdown';

/** Server preference order. First entry is the default representation. */
const PRODUCES = [MEDIA_HTML, MEDIA_MARKDOWN] as const;

export type Produced = (typeof PRODUCES)[number];

interface AcceptEntry {
  type: string;
  q: number;
  /** 2 = exact type, 1 = `type/*`, 0 = `* / *`. */
  specificity: number;
}

function parseAccept(header: string): AcceptEntry[] {
  return header.split(',').map((raw) => {
    const parts = raw
      .trim()
      .split(';')
      .map((s) => s.trim());
    const type = parts[0].toLowerCase();

    let q = 1;
    for (const param of parts.slice(1)) {
      const [name, value] = param.split('=').map((s) => s.trim());
      if (name !== 'q') continue;
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) q = Math.max(0, Math.min(1, parsed));
    }

    const specificity = type === '*/*' ? 0 : type.endsWith('/*') ? 1 : 2;
    return { type, q, specificity };
  });
}

function matches(entry: AcceptEntry, candidate: string): boolean {
  if (entry.type === '*/*') return true;
  if (entry.type.endsWith('/*')) {
    return candidate.startsWith(entry.type.slice(0, -1));
  }
  return entry.type === candidate;
}

/**
 * The representation to serve, or `null` when the client accepts none of them
 * — which is the only case that warrants a 406.
 *
 * A missing or empty header means "no constraint", not "nothing works", so it
 * resolves to the default rather than to `null`.
 */
export function preferredType(header: string | null): Produced | null {
  if (!header?.trim()) return PRODUCES[0];

  const entries = parseAccept(header);
  if (entries.length === 0) return PRODUCES[0];

  let best: Produced | null = null;
  let bestQ = -1;
  let bestPosition = Number.POSITIVE_INFINITY;

  for (const candidate of PRODUCES) {
    // The *most specific* matching range wins for this candidate, whatever its
    // q — so `text/html;q=0, */*` correctly rejects HTML instead of letting
    // the wildcard revive it.
    let matched: AcceptEntry | null = null;
    let matchedPosition = Number.POSITIVE_INFINITY;

    for (const [index, entry] of entries.entries()) {
      if (!matches(entry, candidate)) continue;
      if (
        matched === null ||
        entry.specificity > matched.specificity ||
        (entry.specificity === matched.specificity && index < matchedPosition)
      ) {
        matched = entry;
        matchedPosition = index;
      }
    }

    if (matched === null || matched.q <= 0) continue;

    // Across candidates: highest q wins, ties broken by client order, so
    // `Accept: text/markdown, text/html` picks markdown.
    if (
      matched.q > bestQ ||
      (matched.q === bestQ && matchedPosition < bestPosition)
    ) {
      bestQ = matched.q;
      bestPosition = matchedPosition;
      best = candidate;
    }
  }

  return best;
}

/**
 * Append `Accept` to an existing `Vary`, preserving what is already there.
 *
 * Next sets `Vary: rsc, next-router-state-tree, …` on every response; clobbering
 * it would break router-cache correctness, and omitting `Accept` lets a CDN
 * hand an agent the cached HTML variant.
 */
export function appendVaryAccept(headers: Headers): void {
  const existing = headers.get('Vary');
  if (!existing) {
    headers.set('Vary', 'Accept');
    return;
  }
  const tokens = existing.split(',').map((s) => s.trim().toLowerCase());
  if (!tokens.includes('accept') && !tokens.includes('*')) {
    headers.set('Vary', `${existing}, Accept`);
  }
}
