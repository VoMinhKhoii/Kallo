import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import type { RateLimitKey } from './types';

/**
 * Peppered, versioned key hashing.
 *
 * Nothing identifying is ever written to `rate_limit_counters` /
 * `rate_limit_events`: an IP or an email address becomes an HMAC under a
 * server-side pepper, so a database read cannot enumerate who was throttled,
 * and a stolen dump cannot be brute-forced back to addresses without the
 * pepper.
 *
 * The stored value carries a `v1:` prefix. That is what makes a pepper
 * rotation an explicit migration rather than a silent, global quota reset:
 * bumping the pepper alone would make every live key miss its row and hand
 * every attacker a fresh budget, whereas bumping the prefix says so out loud
 * and lets the old rows age out through the reaper. See docs/RATE_LIMITING.md.
 */
const KEY_VERSION = 'v1';

// Same fallback as the analysis guard: unit tests must be able to hash without
// a real pepper, and every other environment must fail loudly without one.
const testHashSecret = 'analysis-guard-event-test-secret';

function getRateLimitHashSecret() {
  const secret = process.env.ANALYSIS_GUARD_HASH_SECRET;

  if (secret) return secret;
  if (process.env.NODE_ENV === 'test') return testHashSecret;

  throw new Error('ANALYSIS_GUARD_HASH_SECRET is required');
}

/**
 * A key that cannot be turned into a counter identity (today: an IP the
 * runtime handed us that does not parse). Callers treat it as "no key
 * available" and fall through to their remaining policies — never as a pass.
 */
export class RateLimitKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitKeyError';
  }
}

function padHextet(hextet: string) {
  return hextet.toLowerCase().padStart(4, '0');
}

/**
 * Expand a (already `isIP`-validated) IPv6 literal to its eight hextets.
 *
 * Hand-rolled because Node ships no address parser and the alternative is a
 * dependency for forty lines of string work. An embedded IPv4 tail
 * (`64:ff9b::192.0.2.1`) is folded into two hextets first so `::` expansion
 * only ever counts colon groups.
 */
function expandIpv6(value: string): string[] | null {
  let literal = value;
  const embeddedV4 = literal.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);

  if (embeddedV4) {
    const octets = embeddedV4[1].split('.').map(Number);
    const high = ((octets[0] << 8) | octets[1]).toString(16);
    const low = ((octets[2] << 8) | octets[3]).toString(16);
    literal = `${literal.slice(0, -embeddedV4[1].length)}${high}:${low}`;
  }

  const halves = literal.split('::');
  if (halves.length > 2) return null;

  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];

  if (halves.length === 1) {
    return head.length === 8 ? head.map(padHextet) : null;
  }

  const fill = 8 - head.length - tail.length;
  if (fill < 0) return null;

  return [...head, ...Array.from({ length: fill }, () => '0'), ...tail].map(
    padHextet
  );
}

/**
 * The IPv4 address inside an RFC 4291 IPv4-mapped IPv6 address, or `null`.
 *
 * Detected on the EXPANDED hextets rather than on the literal, because
 * `::ffff:1.2.3.4`, `::ffff:0102:0304` and `0:0:0:0:0:ffff:1.2.3.4` are the
 * same address written three ways and a text pattern only ever catches one of
 * them — the two it misses would be aggregated to `0000:0000:0000:0000::/64`,
 * i.e. every mapped client in the world sharing one counter.
 *
 * `::ffff:0:1.2.3.4` is deliberately NOT matched: that is the SIIT translation
 * prefix `::ffff:0:0/96`, a different (and routable) block, so it stays a
 * plain IPv6 address and aggregates to its /64 like any other.
 */
function mappedIpv4(hextets: readonly string[]): string | null {
  const prefixIsZero = hextets.slice(0, 5).every((hextet) => hextet === '0000');
  if (!prefixIsZero || hextets[5] !== 'ffff') return null;

  const high = Number.parseInt(hextets[6], 16);
  const low = Number.parseInt(hextets[7], 16);

  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
}

/**
 * Canonical counter identity for an IP.
 *
 * IPv6 is aggregated to its /64 prefix before hashing. A residential IPv6
 * customer is routinely handed a /64 (often a /56 or /48), so a per-address
 * limit is no limit at all — the same machine can mint a fresh "identity" for
 * every request out of its own subnet. /64 is the smallest unit an attacker
 * cannot subdivide.
 *
 * IPv4-mapped addresses (`::ffff:1.2.3.4`, in every spelling) fold back to the
 * IPv4 address rather than aggregating: their /64 is a single constant, so
 * treating them as IPv6 would collapse every mapped client onto one shared
 * counter.
 */
export function canonicalizeRateLimitIp(value: string): string {
  const trimmed = value.trim().replace(/^\[|\]$/g, '');
  // A scope id (`fe80::1%eth0`) is local to the sender's host, never routable.
  const withoutZone = trimmed.split('%')[0];

  if (isIP(withoutZone) === 4) return withoutZone;

  if (isIP(withoutZone) === 6) {
    const hextets = expandIpv6(withoutZone.toLowerCase());

    if (!hextets) {
      throw new RateLimitKeyError(`unparseable IPv6 address: ${value}`);
    }

    return mappedIpv4(hextets) ?? `${hextets.slice(0, 4).join(':')}::/64`;
  }

  throw new RateLimitKeyError(`unparseable IP address: ${value}`);
}

/**
 * `v1:<hmac>` for a key.
 *
 * The HMAC payload is `rl.v1:<kind>:<value>`, so the kinds are domain-separated
 * — an email used as an `account` key and the same email used as a `recipient`
 * key hash differently and cannot share a counter — and the whole namespace is
 * separated from the analysis guard's `user:`/`ip:` payloads even though both
 * read the same pepper.
 */
export function hashRateLimitKey(key: RateLimitKey): string {
  const value =
    key.kind === 'ip' ? canonicalizeRateLimitIp(key.value) : key.value;

  if (!value) {
    throw new RateLimitKeyError(`empty rate limit key value for ${key.kind}`);
  }

  const digest = createHmac('sha256', getRateLimitHashSecret())
    .update(`rl.${KEY_VERSION}:${key.kind}:${value}`)
    .digest('hex');

  return `${KEY_VERSION}:${digest}`;
}
