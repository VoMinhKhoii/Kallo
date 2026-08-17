import { inArray } from 'drizzle-orm';
import type { RevenueCatEvent } from '@/lib/domain/billing/revenuecat/webhook/parse';
import type { AppDb } from '@/lib/infra/db';
import { userProfiles } from '@/lib/infra/db/schema';

// Which Kallo accounts an event could belong to. RevenueCat App User IDs are
// opaque strings — anonymous ids, aliases, transfer participants — so this is
// the one place that turns them into local user ids, and the one place that
// decides which of them are even eligible to receive a grant.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function uniqueUuidCandidates(
  values: Array<string | null | undefined>
): string[] {
  return [
    ...new Set(
      values.filter(
        (value): value is string =>
          typeof value === 'string' && UUID_RE.test(value)
      )
    ),
  ];
}

export function identityCandidates(event: RevenueCatEvent): string[] {
  if (event.type === 'TRANSFER') {
    return uniqueUuidCandidates([
      ...(event.transferred_to ?? []),
      ...(event.transferred_from ?? []),
    ]);
  }

  if (event.type === 'PURCHASE_REDEEMED') {
    // Only redeemed_by is the grant recipient. redeemed_from and the original
    // purchaser are audit context and must never become fallback owners.
    return uniqueUuidCandidates(event.redeemed_by ?? []);
  }

  return uniqueUuidCandidates([
    event.app_user_id,
    event.original_app_user_id,
    ...(event.aliases ?? []),
  ]);
}

export function preferredIdentityCandidates(event: RevenueCatEvent): string[] {
  if (event.type === 'PURCHASE_REDEEMED') {
    return uniqueUuidCandidates(event.redeemed_by ?? []);
  }
  return uniqueUuidCandidates([event.app_user_id]);
}

export async function existingUserIds(
  database: AppDb,
  candidates: string[]
): Promise<string[]> {
  if (candidates.length === 0) return [];
  const rows = await database
    .select({ userId: userProfiles.userId })
    .from(userProfiles)
    .where(inArray(userProfiles.userId, candidates));
  const existing = new Set(rows.map((row) => row.userId));
  return candidates.filter((candidate) => existing.has(candidate));
}
