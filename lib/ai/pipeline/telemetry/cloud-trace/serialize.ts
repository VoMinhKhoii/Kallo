const MAX_CHARS = 2_000_000;
const PRIVATE_KEY =
  /user.?id|user.?context|email|image|base64|url|authorization|access.?token|refresh.?token|password/i;
const TEXT_KEY = /["']([^"'\r\n]*)["']\s*:/g;

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
      return bounded
        .replace(/[^\s<>"\\]+/g, (word) =>
          word.includes('@') ? '[email]' : word
        )
        // Any scheme, any case, and JSON-escaped slashes (`https:\/\/`); bare www. too.
        .replace(/\b[a-z][a-z0-9+.-]*:(?:\/|\\\/){2}[^\s<>"]+/gi, '[url]')
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
