const MAX_CHARS = 2_000_000;
const PRIVATE_KEY =
  /user.?id|user.?context|email|image|base64|signed.?url|authorization|access.?token|refresh.?token|password/i;

/** Bounded traversal; never invoke toJSON or retain identity/image fields. */
export function serializeTrace(payload: unknown): {
  json: string;
  truncated: boolean;
} {
  let remaining = MAX_CHARS;
  let nodes = 20_000;
  let truncated = false;
  const seen = new WeakSet<object>();
  function clean(value: unknown, depth: number): unknown {
    if (--nodes < 0 || remaining <= 0 || depth > 24) {
      truncated = true;
      return null;
    }
    if (typeof value === 'string') {
      const bounded = value.slice(0, remaining);
      truncated ||= bounded.length < value.length;
      remaining -= bounded.length;
      return bounded
        .replace(/[^\s<>"\\]+/g, (word) =>
          word.includes('@') ? '[email]' : word
        )
        .replace(/https?:\/\/[^\s<>"\\]+/g, '[url]')
        .replace(/data:[^\s"]+/g, '[data]');
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
      result[key] = clean((value as Record<string, unknown>)[key], depth + 1);
    }
    seen.delete(value);
    return result;
  }
  return { json: JSON.stringify(clean(payload, 0)), truncated };
}
