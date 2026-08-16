import { and, eq, gte, sql } from 'drizzle-orm';
import type { WaitlistSignupInput } from '@/lib/api/contracts/waitlist';
import { type AppDb, db as appDb } from '@/lib/db';
import { waitlistSignups } from '@/lib/db/schema';
import { sendEmail as defaultSendEmail } from '@/lib/email/send';
import { waitlistConfirmEmail } from '@/lib/email/templates/waitlist';
import { Errors } from '@/lib/errors/catalog';
import { SITE_URL } from '@/lib/seo/site';
import { hashIp, issueConfirmationToken } from '@/lib/waitlist/token';

/**
 * Waitlist signup, double opt-in.
 *
 * Two rules shape everything below:
 *
 * - **The response never varies.** New address, pending address and confirmed
 *   address all return the same thing, so the endpoint can't be used to test
 *   whether a given person is on the list.
 * - **The row is not membership.** Only `confirmed_at` is. An unconfirmed row
 *   is just a pending invitation, which is what stops someone from adding a
 *   stranger's address.
 */

/** Distinct signups accepted from one IP per rolling hour. */
const IP_HOURLY_LIMIT = 5;
/**
 * Minimum gap between two confirmation emails to the same address. Stops the
 * form being used to mail-bomb someone, while still letting a person who never
 * received the first one try again a few minutes later.
 */
const RESEND_COOLDOWN_MS = 5 * 60 * 1000;

const HOUR_MS = 60 * 60 * 1000;

export interface WaitlistSignupDeps {
  db?: AppDb;
  sendEmail?: typeof defaultSendEmail;
  now?: () => Date;
}

export interface WaitlistSignupContext {
  /** Raw client IP; hashed before it touches the database. */
  ip?: string | null;
}

/**
 * Normalise an address for storage and comparison.
 *
 * Lowercased and NFC-normalised so `Nguyen@Example.com` and a decomposed
 * Unicode variant collapse onto one row. The local part is technically
 * case-sensitive per RFC 5321, but no mail provider anyone uses treats it that
 * way, and one row per human is what the unique index is for.
 */
export function normaliseEmail(email: string): string {
  return email.trim().normalize('NFC').toLowerCase();
}

/** Build the link that confirms a signup. */
export function confirmationUrl(token: string): string {
  const url = new URL('/api/v1/waitlist/confirm', SITE_URL);
  url.searchParams.set('token', token);
  return url.toString();
}

export async function signUpForWaitlist(
  input: WaitlistSignupInput,
  context: WaitlistSignupContext = {},
  deps: WaitlistSignupDeps = {}
): Promise<void> {
  const db = deps.db ?? appDb;
  const send = deps.sendEmail ?? defaultSendEmail;
  const now = deps.now?.() ?? new Date();

  const email = normaliseEmail(input.email);
  const locale = input.locale ?? 'en';
  const ipHash = hashIp(context.ip ?? null);
  const token = issueConfirmationToken(now);

  // Everything that decides "do we send an email?" happens inside one
  // transaction. Two advisory locks serialise the checks that a concurrent
  // request could otherwise race: one per-address (so two submits of the same
  // email can't both pass the cooldown and both mail) and one per-IP (so the
  // per-IP quota can't be bypassed by firing N distinct emails at once, each
  // reading the same pre-insert count). Both are transaction-scoped.
  const shouldSend = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${email}))`);
    if (ipHash) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${ipHash}))`);
    }

    await assertIpQuota(tx, ipHash, now);

    const [existing] = await tx
      .select({
        id: waitlistSignups.id,
        confirmedAt: waitlistSignups.confirmedAt,
        confirmationSentAt: waitlistSignups.confirmationSentAt,
      })
      .from(waitlistSignups)
      .where(eq(waitlistSignups.email, email))
      .limit(1);

    // Already on the list: nothing to do, and nothing to say about it.
    if (existing?.confirmedAt) return false;

    if (existing) {
      // Pending: re-issue rather than error, since the usual reason someone
      // re-submits is that the first email never arrived — but not more often
      // than the cooldown, so the form can't be pointed at a stranger's inbox.
      if (
        existing.confirmationSentAt &&
        existing.confirmationSentAt.getTime() >
          now.getTime() - RESEND_COOLDOWN_MS
      ) {
        return false;
      }

      await tx
        .update(waitlistSignups)
        .set({
          locale,
          source: input.source ?? null,
          confirmationTokenHash: token.tokenHash,
          confirmationSentAt: now,
          confirmationExpiresAt: token.expiresAt,
          ipHash,
          updatedAt: now,
        })
        .where(eq(waitlistSignups.id, existing.id));
      return true;
    }

    await tx.insert(waitlistSignups).values({
      email,
      locale,
      source: input.source ?? null,
      confirmationTokenHash: token.tokenHash,
      confirmationSentAt: now,
      confirmationExpiresAt: token.expiresAt,
      ipHash,
      createdAt: now,
      updatedAt: now,
    });
    return true;
  });

  if (!shouldSend) return;

  // Outside the transaction on purpose: a provider hiccup must not roll back a
  // stored signup, and the row is what the retry path reads. But the row was
  // stamped `confirmationSentAt: now` so the cooldown protects against
  // mail-bombing during this window — if the send then fails, that stamp would
  // wrongly block a legitimate immediate retry. So clear it on failure (the
  // token stays valid) and rethrow, leaving the row retryable.
  try {
    await send({
      to: email,
      message: waitlistConfirmEmail(locale, confirmationUrl(token.token)),
      tags: [{ name: 'kind', value: 'waitlist_confirm' }],
    });
  } catch (error) {
    await db
      .update(waitlistSignups)
      .set({ confirmationSentAt: null })
      .where(eq(waitlistSignups.confirmationTokenHash, token.tokenHash));
    throw error;
  }
}

/** Throws `rateLimited` when this IP has submitted too often. */
async function assertIpQuota(
  tx: Parameters<Parameters<AppDb['transaction']>[0]>[0],
  ipHash: string | null,
  now: Date
): Promise<void> {
  if (!ipHash) return;

  const [{ count }] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(waitlistSignups)
    .where(
      and(
        eq(waitlistSignups.ipHash, ipHash),
        gte(waitlistSignups.updatedAt, new Date(now.getTime() - HOUR_MS))
      )
    );

  if (count >= IP_HOURLY_LIMIT) {
    throw Errors.rateLimited();
  }
}
