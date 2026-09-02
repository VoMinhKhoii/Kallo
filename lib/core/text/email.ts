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

/** Providers that ignore dots in the local part, so `a.b@` == `ab@`. */
const DOT_INSENSITIVE_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

/**
 * Collapse the spellings of ONE mailbox onto a single rate-limit key.
 *
 * `normaliseEmail` handles case and Unicode form; this handles the two tricks
 * an attacker uses to buy a fresh mail-bombing budget for a mailbox that is
 * already at its limit:
 *
 *  - **Plus addressing.** `victim+1@x.com` … `victim+9999@x.com` all deliver
 *    to `victim@x.com`. Every major provider (Gmail, Outlook, Fastmail,
 *    Proton, iCloud) implements it, so a per-spelling counter is a per-request
 *    counter.
 *  - **Dots, on Google only.** `v.i.c.t.i.m@gmail.com` is `victim@gmail.com`.
 *    This is NOT generic behaviour — dots are significant almost everywhere
 *    else — so it is applied to `gmail.com` / `googlemail.com` and nowhere
 *    else, on purpose.
 *
 * FOR THE LIMITER KEY ONLY. What we forward upstream is always the address the
 * caller actually typed: GoTrue is what decides where mail goes and which
 * account exists, and rewriting an address on the way through would create
 * accounts nobody asked for. Two people who really do own `a+work@x.com` and
 * `a+home@x.com` share one counter here — which is correct, because they share
 * one inbox.
 */
export function canonicalizeEmailForKey(email: string): string {
  const normalised = normaliseEmail(email);
  const at = normalised.lastIndexOf('@');
  if (at <= 0 || at === normalised.length - 1) return normalised;

  const domain = normalised.slice(at + 1);
  let local = normalised.slice(0, at);

  const plus = local.indexOf('+');
  if (plus > 0) local = local.slice(0, plus);
  if (DOT_INSENSITIVE_DOMAINS.has(domain)) local = local.replaceAll('.', '');

  // A local part that was NOTHING but a tag (`+tag@x.com`) has no mailbox to
  // collapse onto; keep the normalised original rather than inventing `@x.com`.
  return local.length > 0 ? `${local}@${domain}` : normalised;
}
