import { and, eq, isNotNull } from 'drizzle-orm';
import type { WaitlistStatus } from '@/lib/api/contracts/waitlist';
import { hashConfirmationToken } from '@/lib/domain/waitlist/token';
import { type AppDb, db as appDb } from '@/lib/infra/db';
import { waitlistSignups } from '@/lib/infra/db/schema';
import { sendEmail as defaultSendEmail } from '@/lib/infra/email/send';
import type { EmailLocale } from '@/lib/infra/email/templates/layout';
import { waitlistWelcomeEmail } from '@/lib/infra/email/templates/waitlist';

/**
 * Second half of the double opt-in: following the emailed link is what actually
 * puts someone on the list.
 */

export interface WaitlistConfirmDeps {
  db?: AppDb;
  sendEmail?: typeof defaultSendEmail;
  now?: () => Date;
}

export interface WaitlistConfirmResult {
  status: WaitlistStatus;
  /** Locale to redirect in; the row's own, falling back to English. */
  locale: EmailLocale;
}

export async function confirmWaitlistSignup(
  token: string,
  deps: WaitlistConfirmDeps = {}
): Promise<WaitlistConfirmResult> {
  const db = deps.db ?? appDb;
  const send = deps.sendEmail ?? defaultSendEmail;
  const now = deps.now?.() ?? new Date();

  if (!token) return { status: 'invalid', locale: 'en' };

  const [row] = await db
    .select({
      id: waitlistSignups.id,
      email: waitlistSignups.email,
      locale: waitlistSignups.locale,
      confirmedAt: waitlistSignups.confirmedAt,
      confirmationExpiresAt: waitlistSignups.confirmationExpiresAt,
    })
    .from(waitlistSignups)
    .where(
      eq(waitlistSignups.confirmationTokenHash, hashConfirmationToken(token))
    )
    .limit(1);

  if (!row) return { status: 'invalid', locale: 'en' };

  const locale: EmailLocale = row.locale === 'vi' ? 'vi' : 'en';

  // Confirming twice is a normal thing for a human to do (they clicked the link
  // again, or a mail client prefetched it), so it gets its own status rather
  // than looking like a failure.
  if (row.confirmedAt) return { status: 'already', locale };

  if (
    row.confirmationExpiresAt &&
    row.confirmationExpiresAt.getTime() < now.getTime()
  ) {
    return { status: 'expired', locale };
  }

  // Single-use, race-safe: the UPDATE also requires the hash to still be set,
  // so of two concurrent requests carrying the same token only the first
  // matches a row — the second updates zero rows and falls through to the
  // guard below. Without the isNotNull guard both would UPDATE by id and both
  // would fire the welcome email.
  const updated = await db
    .update(waitlistSignups)
    .set({
      confirmedAt: now,
      confirmationTokenHash: null,
      confirmationExpiresAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(waitlistSignups.id, row.id),
        isNotNull(waitlistSignups.confirmationTokenHash)
      )
    )
    .returning({ id: waitlistSignups.id });

  // Lost the race (or already confirmed between our SELECT and UPDATE): the
  // other request owns the welcome email, so report the idempotent outcome.
  if (updated.length === 0) return { status: 'already', locale };

  // Best-effort: the person is confirmed either way, so a mail failure must not
  // turn a successful confirmation into an error page.
  try {
    await send({
      to: row.email,
      message: waitlistWelcomeEmail(locale),
      tags: [{ name: 'kind', value: 'waitlist_welcome' }],
    });
  } catch (error) {
    console.error(
      '[waitlist] welcome email failed:',
      error instanceof Error ? error.message : error
    );
  }

  return { status: 'confirmed', locale };
}
