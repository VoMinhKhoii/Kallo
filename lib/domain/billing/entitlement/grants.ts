import { and, eq } from 'drizzle-orm';
import type { BillingEnvironment } from '@/lib/domain/billing/revenuecat/identity';
import { type AppDb, db as appDb } from '@/lib/infra/db/client';
import { entitlementGrants } from '@/lib/infra/db/schema';

// Grant writers — the provider-agnostic edits to `entitlement_grants`, used by
// admin/promo tooling. Never call these from client-facing request handlers:
// entitlement_grants is the server-side source of truth and must never be
// mutated from client input. Reads live in service.ts; this module only
// WRITES. The RevenueCat projection is NOT here — it owns its own transaction
// in `lib/billing/revenuecat/reconciliation.ts`. DI mirrors the service
// (optional `db`, defaults to the app client) so tests can drive a stub.

type GrantStatus = 'active' | 'canceled' | 'expired' | 'refunded';

export interface GrantMutationDeps {
  db?: AppDb;
  now?: () => Date;
}

export interface UpsertGrantInput {
  userId: string;
  entitlementKey: string;
  source: string;
  environment: BillingEnvironment;
  // RC's event.store lowercased (app_store, play_store, paddle, ...). Nullable
  // — not every source/event carries a store. Persisted for the settings
  // "manage subscription" deep link, never for gating.
  store: string | null;
  productId: string | null;
  startsAt: Date;
  // null = lifetime (never expires).
  expiresAt: Date | null;
  status: GrantStatus;
  willRenew: boolean;
  // Stable id at the source (RC original transaction / subscription id). The
  // (source, external_ref, environment) unique constraint makes this the
  // upsert key so
  // webhook retries and renewals update one row instead of stacking rows.
  externalRef: string;
  providerSyncedAt?: Date | null;
  managementUrl?: string | null;
}

/**
 * Insert a grant, or update the existing row for this
 * (source, externalRef, environment).
 *
 * Renewals and webhook redeliveries carry the same externalRef, so this
 * collapses onto one row via `onConflictDoUpdate`. userId is refreshed too so
 * a TRANSFER that re-runs a purchase event lands the grant on the right user.
 */
export async function upsertGrant(
  input: UpsertGrantInput,
  deps?: GrantMutationDeps
): Promise<void> {
  const database = deps?.db ?? appDb;
  const now = deps?.now?.() ?? new Date();

  await database
    .insert(entitlementGrants)
    .values({
      userId: input.userId,
      entitlementKey: input.entitlementKey,
      source: input.source,
      environment: input.environment,
      store: input.store,
      productId: input.productId,
      startsAt: input.startsAt,
      expiresAt: input.expiresAt,
      status: input.status,
      willRenew: input.willRenew,
      externalRef: input.externalRef,
      providerSyncedAt: input.providerSyncedAt ?? null,
      managementUrl: input.managementUrl ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        entitlementGrants.source,
        entitlementGrants.externalRef,
        entitlementGrants.environment,
      ],
      set: {
        userId: input.userId,
        store: input.store,
        productId: input.productId,
        startsAt: input.startsAt,
        expiresAt: input.expiresAt,
        status: input.status,
        willRenew: input.willRenew,
        providerSyncedAt: input.providerSyncedAt ?? null,
        managementUrl: input.managementUrl ?? null,
        updatedAt: now,
      },
    });
}

export interface MarkGrantStatusInput {
  source: string;
  environment: BillingEnvironment;
  externalRef: string;
  // 'canceled' here means REVOKED-before-expiry (a hard end of access). A
  // normal auto-renew-off cancellation is NOT this — that keeps status
  // 'active' with willRenew=false and is handled by setGrantWillRenew.
  status: 'canceled' | 'expired' | 'refunded';
}

/**
 * Flip an existing grant's status by (source, externalRef). No-op if the row
 * does not exist (an EXPIRATION/REFUND for a grant we never recorded — e.g.
 * an event that arrived before its purchase — is harmless to drop).
 */
export async function markGrantStatus(
  input: MarkGrantStatusInput,
  deps?: GrantMutationDeps
): Promise<void> {
  const database = deps?.db ?? appDb;
  const now = deps?.now?.() ?? new Date();

  await database
    .update(entitlementGrants)
    .set({ status: input.status, updatedAt: now })
    .where(
      and(
        eq(entitlementGrants.source, input.source),
        eq(entitlementGrants.externalRef, input.externalRef),
        eq(entitlementGrants.environment, input.environment)
      )
    );
}

export interface SetGrantWillRenewInput {
  source: string;
  environment: BillingEnvironment;
  externalRef: string;
  willRenew: boolean;
}

/**
 * Toggle auto-renew on an existing grant WITHOUT touching status. This is the
 * CANCELLATION (auto-renew off) path: access continues to the period end, so
 * status stays 'active' and only willRenew flips false. No-op if the row is
 * absent.
 */
export async function setGrantWillRenew(
  input: SetGrantWillRenewInput,
  deps?: GrantMutationDeps
): Promise<void> {
  const database = deps?.db ?? appDb;
  const now = deps?.now?.() ?? new Date();

  await database
    .update(entitlementGrants)
    .set({ willRenew: input.willRenew, updatedAt: now })
    .where(
      and(
        eq(entitlementGrants.source, input.source),
        eq(entitlementGrants.externalRef, input.externalRef),
        eq(entitlementGrants.environment, input.environment)
      )
    );
}

export interface ReassignGrantsInput {
  source: string;
  environment: BillingEnvironment;
  externalRefs: string[];
  userId: string;
}

/**
 * Move grants (by their externalRefs) to a new userId — the TRANSFER path.
 * Only used when the affected subscription identifiers are known from the
 * payload; callers that cannot determine them cleanly record a
 * processing_error instead of guessing.
 */
export async function reassignGrants(
  input: ReassignGrantsInput,
  deps?: GrantMutationDeps
): Promise<void> {
  if (input.externalRefs.length === 0) return;

  const database = deps?.db ?? appDb;
  const now = deps?.now?.() ?? new Date();

  for (const externalRef of input.externalRefs) {
    await database
      .update(entitlementGrants)
      .set({ userId: input.userId, updatedAt: now })
      .where(
        and(
          eq(entitlementGrants.source, input.source),
          eq(entitlementGrants.externalRef, externalRef),
          eq(entitlementGrants.environment, input.environment)
        )
      );
  }
}
