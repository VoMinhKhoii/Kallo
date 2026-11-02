import { and, eq, gt, gte, sql } from 'drizzle-orm';
import type { WaitlistSignupInput } from '@/lib/api/contracts/waitlist';
import { Errors } from '@/lib/core/errors/catalog';
import {
  canonicalizeEmailForKey,
  hasAliasSpellings,
  normaliseEmail,
} from '@/lib/core/text/email';
import { hashIp, issueConfirmationToken } from '@/lib/domain/waitlist/token';
import { type AppDb, db as appDb } from '@/lib/infra/db/client';
import { waitlistSignups } from '@/lib/infra/db/schema';
import { EMAIL_SEND_TIMEOUT_MS } from '@/lib/infra/email/config';
import { sendEmail as defaultSendEmail } from '@/lib/infra/email/send';
import { waitlistConfirmEmail } from '@/lib/infra/email/templates/waitlist';
import { reportError } from '@/lib/infra/telemetry/monitoring/report-error';
import { SITE_URL } from '@/lib/seo/site';

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
/** The send deadline plus headroom for the signup transaction and rollback. */
const RESPONSE_FLOOR_MS = EMAIL_SEND_TIMEOUT_MS + 500;

export interface WaitlistSignupDeps {
  db?: AppDb;
  sendEmail?: typeof defaultSendEmail;
  now?: () => Date;
}

export interface WaitlistSignupContext {
  /** Raw client IP; hashed before it touches the database. */
  ip?: string | null;
  /**
   * The mailbox's own limiter refused this request. Nothing is stored or sent,
   * but the caller still gets the same answer after the same floor: the
   * refusal is about one address, so it must not read differently.
   */
  mailboxThrottled?: boolean;
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
  const startedAt = performance.now();
  try {
    if (!context.mailboxThrottled) await storeAndSend(input, context, deps);
  } finally {
    // Keep sending inside the request: Cloud Run throttles CPU after response.
    // Every branch waits to the same floor, including confirmed and cooldown.
    const remaining = RESPONSE_FLOOR_MS - (performance.now() - startedAt);
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
  }
}

async function storeAndSend(
  input: WaitlistSignupInput,
  context: WaitlistSignupContext,
  deps: WaitlistSignupDeps
): Promise<void> {
  const db = deps.db ?? appDb;
  const send = deps.sendEmail ?? defaultSendEmail;
  const now = deps.now?.() ?? new Date();

  const email = normaliseEmail(input.email);
  const mailbox = canonicalizeEmailForKey(email);
  const locale = input.locale ?? 'en';
  const ipHash = hashIp(context.ip ?? null);
  const token = issueConfirmationToken(now);

  // Everything that decides "do we send an email?" happens inside one
  // transaction. Two advisory locks serialise the checks that a concurrent
  // request could otherwise race: one per-mailbox (so aliases cannot both
  // pass the cooldown and both mail) and one per-IP (so the
  // per-IP quota can't be bypassed by firing N distinct emails at once, each
  // reading the same pre-insert count). Both are transaction-scoped.
  const shouldSend = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${mailbox}))`);
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

    // The shared limiter owns the daily mailbox budget. The exact rolling
    // cooldown also reads recent aliases while holding the mailbox lock. The
    // global admission policy bounds this small recent-row scan; no new column
    // or second implementation of provider alias semantics is needed.
    if (await mailboxCoolingDown(tx, email, mailbox, now)) return false;

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
  // token stays valid). Report failures without changing the caller's result.
  try {
    await send({
      to: email,
      message: waitlistConfirmEmail(locale, confirmationUrl(token.token)),
    });
  } catch (error) {
    try {
      await db
        .update(waitlistSignups)
        .set({ confirmationSentAt: null })
        .where(eq(waitlistSignups.confirmationTokenHash, token.tokenHash));
    } catch (rollbackError) {
      logSendFailure('confirmation rollback failed', rollbackError);
    }
    logSendFailure('confirmation email failed', error);
  }
}

function logSendFailure(message: string, error: unknown) {
  console.error(`[waitlist] ${message}:`, error);
  reportError(error, '[waitlist]', { redactMessage: true });
}

async function mailboxCoolingDown(
  tx: Parameters<Parameters<AppDb['transaction']>[0]>[0],
  email: string,
  mailbox: string,
  now: Date
): Promise<boolean> {
  // Other providers keep distinct plus/dot mailboxes; their exact-address
  // cooldown below already covers the canonical key.
  if (!hasAliasSpellings(email)) return false;
  const recent = await tx
    .select({ email: waitlistSignups.email })
    .from(waitlistSignups)
    .where(
      gt(
        waitlistSignups.confirmationSentAt,
        new Date(now.getTime() - RESEND_COOLDOWN_MS)
      )
    );
  return recent.some((row) => canonicalizeEmailForKey(row.email) === mailbox);
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
