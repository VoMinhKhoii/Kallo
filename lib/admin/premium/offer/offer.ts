import 'server-only';
import { eq } from 'drizzle-orm';
import type { AdminUser } from '@/lib/admin/authz/require-admin';
import { recordAudit } from '@/lib/admin/premium/activity/audit';
import type { ParsedOfferInput } from '@/lib/admin/premium/offer/offer-input';
import type { AppDb } from '@/lib/infra/db/client';
import { premiumSettings } from '@/lib/infra/db/schema';

// The welcome offer is one row (id 1) the signup trigger reads
// (20261004145400_welcome_offer_from_settings.sql), so edits apply to the
// next signup with no deploy.

export interface WelcomeOffer {
  enabled: boolean;
  days: number;
  autoOffAt: Date | null;
  updatedAt: Date | null;
  updatedByEmail: string | null;
}

/** Whether a signup at `now` gets the offer, given its settings. */
export function offerIsLive(offer: WelcomeOffer, now: Date): boolean {
  return (
    offer.enabled &&
    (offer.autoOffAt === null || now.getTime() < offer.autoOffAt.getTime())
  );
}

export async function getWelcomeOffer(db: AppDb): Promise<WelcomeOffer> {
  const [row] = await db
    .select()
    .from(premiumSettings)
    .where(eq(premiumSettings.id, 1))
    .limit(1);
  // A missing row means the trigger grants nothing: report it as off.
  if (!row) {
    return {
      enabled: false,
      days: 14,
      autoOffAt: null,
      updatedAt: null,
      updatedByEmail: null,
    };
  }
  return {
    enabled: row.welcomeEnabled,
    days: row.welcomeDays,
    autoOffAt: row.welcomeAutoOffAt,
    updatedAt: row.updatedAt,
    updatedByEmail: row.updatedByEmail,
  };
}

function snapshot(offer: Pick<WelcomeOffer, 'enabled' | 'days' | 'autoOffAt'>) {
  return {
    enabled: offer.enabled,
    days: offer.days,
    autoOffAt: offer.autoOffAt?.toISOString() ?? null,
  };
}

/** Writes the offer settings (no audit) — shared by save and undo. */
export async function writeWelcomeOffer(
  db: AppDb,
  next: Pick<WelcomeOffer, 'enabled' | 'days' | 'autoOffAt'>,
  byEmail: string,
  now: Date
): Promise<void> {
  const values = {
    welcomeEnabled: next.enabled,
    welcomeDays: next.days,
    welcomeAutoOffAt: next.autoOffAt,
    updatedAt: now,
    updatedByEmail: byEmail,
  };
  await db
    .insert(premiumSettings)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: premiumSettings.id, set: values });
}

/** Saves the welcome offer and records before/after so it can be undone. */
export async function saveWelcomeOffer(
  admin: AdminUser,
  input: ParsedOfferInput,
  deps: { db: AppDb; now?: () => Date }
): Promise<void> {
  const now = deps.now?.() ?? new Date();
  const next = {
    enabled: input.enabled,
    days: input.days,
    autoOffAt: input.autoOffOn
      ? new Date(`${input.autoOffOn}T00:00:00.000Z`)
      : null,
  };
  await deps.db.transaction(async (tx) => {
    const db = tx as unknown as AppDb;
    const before = await getWelcomeOffer(db);
    await writeWelcomeOffer(db, next, admin.email, now);
    await recordAudit(
      db,
      admin,
      {
        id: crypto.randomUUID(),
        action: 'offer',
        scope: 'offer',
        userCount: 0,
        reason: input.reason,
        details: { before: snapshot(before), after: snapshot(next) },
      },
      now
    );
  });
}
