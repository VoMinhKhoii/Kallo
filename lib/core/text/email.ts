/**
 * Normalise an address for storage, comparison, and rate-limit keying.
 *
 * Lowercased and NFC-normalised so `Nguyen@Example.com` and a decomposed
 * Unicode variant collapse onto one value. The local part is technically
 * case-sensitive per RFC 5321, but no mail provider anyone uses treats it that
 * way — and for a limiter that is not a nicety: an unnormalised address is a
 * per-spelling counter, so `VICTIM@x.com` and `victim@x.com` would each get a
 * full mail-bombing budget.
 *
 * Lives in `lib/core/` rather than beside its first caller because the
 * Supabase auth proxy needs it too, and an edge route must not import the
 * waitlist domain module (database client, mailer, Drizzle schema) to get one
 * string function.
 */
export function normaliseEmail(email: string): string {
  return email.trim().normalize('NFC').toLowerCase();
}

/**
 * Providers with VERIFIED sub-addressing semantics: a `+tag` all delivers to
 * the tag-free mailbox, and (for these two) dots in the local part are ignored.
 * Both collapses are applied ONLY here, because on an arbitrary domain the
 * operator is free to provision `a@d.com` and `a+x@d.com` as separate
 * mailboxes — collapsing them would let a flood at one exhaust the other's
 * budget.
 */
const KNOWN_ALIAS_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

/**
 * Collapse the spellings of ONE mailbox onto a single rate-limit key.
 *
 * `normaliseEmail` handles case and Unicode form; this handles the two tricks
 * an attacker uses to buy a fresh mail-bombing budget for a mailbox that is
 * already at its limit:
 *
 *  - **Plus addressing, on known-alias domains only.** `victim+1@gmail.com` …
 *    `victim+9999@gmail.com` all deliver to `victim@gmail.com`. Many providers
 *    implement this, but not all — an arbitrary domain can provision `a@d.com`
 *    and `a+x@d.com` as SEPARATE mailboxes — so the collapse is restricted to
 *    the domains whose alias semantics are verified (`KNOWN_ALIAS_DOMAINS`).
 *    Elsewhere the local part is kept intact (still lowercased / NFC / trimmed).
 *  - **Dots, on Google only.** `v.i.c.t.i.m@gmail.com` is `victim@gmail.com`.
 *    This is NOT generic behaviour — dots are significant almost everywhere
 *    else — so it is applied to `gmail.com` / `googlemail.com` and nowhere
 *    else, on purpose.
 *
 * FOR THE LIMITER KEY ONLY. What we forward upstream is always the address the
 * caller actually typed: GoTrue is what decides where mail goes and which
 * account exists, and rewriting an address on the way through would create
 * accounts nobody asked for. Two people who really do own `a+work@gmail.com`
 * and `a+home@gmail.com` share one counter here — which is correct, because
 * they share one inbox.
 */
export function canonicalizeEmailForKey(email: string): string {
  const normalised = normaliseEmail(email);
  const at = normalised.lastIndexOf('@');
  if (at <= 0 || at === normalised.length - 1) return normalised;

  const domain = normalised.slice(at + 1);
  let local = normalised.slice(0, at);

  if (KNOWN_ALIAS_DOMAINS.has(domain)) {
    const plus = local.indexOf('+');
    if (plus > 0) local = local.slice(0, plus);
    local = local.replaceAll('.', '');
  }

  // A local part that was NOTHING but a tag (`+tag@x.com`) has no mailbox to
  // collapse onto; keep the normalised original rather than inventing `@x.com`.
  return local.length > 0 ? `${local}@${domain}` : normalised;
}
