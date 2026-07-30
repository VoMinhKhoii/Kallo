import { eq } from 'drizzle-orm';
import type { WaitlistStatus } from '@/lib/api/contracts/waitlist';
import { type AppDb, db as appDb } from '@/lib/db';
import { waitlistSignups } from '@/lib/db/schema';
import { sendEmail as defaultSendEmail } from '@/lib/email/send';
import type { EmailLocale } from '@/lib/email/templates/layout';
import { waitlistWelcomeEmail } from '@/lib/email/templates/waitlist';
import { hashConfirmationToken } from '@/lib/waitlist/token';

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

  // Single-use: clearing the hash invalidates the link, and the unique index on
  // that column means a second confirm can only ever find NULL, not this row.
  const updated = await db
    .update(waitlistSignups)
    .set({
      confirmedAt: now,
      confirmationTokenHash: null,
      confirmationExpiresAt: null,
      updatedAt: now,
    })
    .where(eq(waitlistSignups.id, row.id))
    .returning({ id: waitlistSignups.id });

  if (updated.length === 0) return { status: 'invalid', locale };

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
