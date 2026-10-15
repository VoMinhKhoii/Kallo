const MAX_CHARS = 2_000_000;
const PRIVATE_KEY =
  /user.?id|user.?context|email|image|base64|url|authorization|access.?token|refresh.?token|password/i;
const TEXT_KEY = /["']([^"'\r\n]*)["']\s*:/g;

const SCHEME_CHAR = /[a-z0-9+.-]/i;
const LETTER = /[a-z]/i;
const URL_END = /[\s<>"]/;

/**
 * Replace `scheme://…` URLs (any scheme or case, including JSON-escaped
 * `:\/\/`) with `[url]` in linear time: anchor on each `://`, walk back over at
 * most 32 scheme characters, then forward to the next delimiter. A regex with a
 * leading `[a-z0-9+.-]*` backtracks quadratically on text like `a.a.a.…`.
 */
function redactUrls(text: string): string {
  const separator = /:(?:\/|\\\/){2}/g;
  let out = '';
  let last = 0;
  for (let m = separator.exec(text); m; m = separator.exec(text)) {
    let start = m.index;
    while (
      start > last &&
      m.index - start < 32 &&
      SCHEME_CHAR.test(text[start - 1])
    )
      start--;
    while (start < m.index && !LETTER.test(text[start])) start++;
    if (start === m.index) continue;
    let end = m.index + m[0].length;
    while (end < text.length && !URL_END.test(text[end])) end++;
    out += `${text.slice(last, start)}[url]`;
    last = end;
    separator.lastIndex = end;
  }
  return out + text.slice(last);
}

/** Bounded traversal; never invoke toJSON or retain identity/image fields. */
export function serializeTrace(payload: unknown): {
  json: string;
  truncated: boolean;
} {
  let remaining = MAX_CHARS;
  let nodes = 20_000;
  let truncated = false;
  const seen = new WeakSet<object>();
  function clean(value: unknown, depth: number, response = false): unknown {
    if (--nodes < 0 || remaining <= 0 || depth > 24) {
      truncated = true;
      return null;
    }
    if (typeof value === 'string') {
      if (response) {
        // Never parse or retain an oversized/partial response: truncation can
        // cut through a private structure before the fallback can recognize it.
        if (value.length > remaining) {
          truncated = true;
          return '[response omitted]';
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(value);
        } catch {
          // Malformed nested values cannot be delimited safely with a regex.
          // Fail closed for the entire response when a private key is present.
          const decoded = value.replace(/\\u([0-9a-f]{4})/gi, (_, hex) =>
            String.fromCharCode(Number.parseInt(hex, 16))
          );
          for (const match of decoded.matchAll(TEXT_KEY)) {
            if (PRIVATE_KEY.test(match[1])) return '[response redacted]';
          }
        }
        if (parsed !== undefined)
          return JSON.stringify(clean(parsed, depth + 1));
      }
      const bounded = value.slice(0, remaining);
      truncated ||= bounded.length < value.length;
      remaining -= bounded.length;
      return redactUrls(bounded)
        .replace(/[^\s<>"\\]+/g, (word) =>
          word.includes('@') ? '[email]' : word
        )
        .replace(/\bwww\.[^\s<>"\\]+/gi, '[url]')
        .replace(/data:[^\s"]+/gi, '[data]');
    }
    if (
      value == null ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    )
      return value;
    if (typeof value !== 'object') return null;
    if (seen.has(value)) {
      truncated = true;
      return null;
    }
    seen.add(value);
    if (value instanceof Date) {
      seen.delete(value);
      return value.toISOString();
    }
    if (Array.isArray(value)) {
      const result: unknown[] = [];
      for (const item of value) {
        if (nodes <= 0 || remaining <= 0) {
          truncated = true;
          break;
        }
        result.push(clean(item, depth + 1));
      }
      seen.delete(value);
      return result;
    }
    const result: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(value)) {
      if (nodes <= 0 || remaining <= 0) {
        truncated = true;
        break;
      }
      if (PRIVATE_KEY.test(key)) continue;
      remaining -= key.length;
      result[key] = clean(
        (value as Record<string, unknown>)[key],
        depth + 1,
        key === 'response'
      );
    }
    seen.delete(value);
    return result;
  }
  return { json: JSON.stringify(clean(payload, 0)), truncated };
}
