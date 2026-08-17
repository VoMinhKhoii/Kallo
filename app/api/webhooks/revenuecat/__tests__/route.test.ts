import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RevenueCatSnapshot } from '@/lib/billing/billing';
import type { AppDb } from '@/lib/db';
import {
  billingProviderSyncs,
  billingWebhookEvents,
  entitlementGrants,
  userProfiles,
} from '@/lib/db/schema';
import { handleRevenueCatWebhook } from '../route';

const SECRET = 'test-webhook-secret';
const USER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_USER_ID = '22222222-2222-2222-2222-222222222222';
const EXTRA_USER_ID = '33333333-3333-3333-3333-333333333333';
const fixedNow = new Date('2026-07-13T00:00:00.000Z');

interface EventRow {
  id: string;
  source: string;
  externalEventId: string;
  deploymentEnvironment: 'production' | 'sandbox';
  processedAt: Date | null;
  processingError: string | null;
  attemptCount: number;
  nextAttemptAt: Date | null;
  deadLetteredAt: Date | null;
  userId: string | null;
}

interface GrantRow {
  id: string;
  userId: string;
  source: string;
  environment: 'production' | 'sandbox';
  externalRef: string;
  entitlementKey: string;
  status: string;
  providerSyncedAt: Date | null;
  [key: string]: unknown;
}

interface ProviderSyncRow {
  id: string;
  userId: string;
  source: string;
  environment: string;
  providerSyncedAt: Date;
  ownershipEventAt: Date | null;
  ownershipEventId: string | null;
  ownershipEventPriority: number;
  ownershipRevoked: boolean;
  customerMissingSince: Date | null;
}

class InMemoryDb {
  events: EventRow[] = [];
  grants: GrantRow[] = [];
  providerSyncs: ProviderSyncRow[] = [];
  existingUserIds = new Set([USER_ID, OTHER_USER_ID, EXTRA_USER_ID]);
  failGrantWriteForUserId: string | null = null;

  get client(): AppDb {
    return {
      insert: (table: unknown) => this.insert(table),
      update: (table: unknown) => this.update(table),
      select: () => this.select(),
      transaction: async (callback: (tx: AppDb) => Promise<void>) => {
        const grantsBefore = this.grants.map((row) => ({ ...row }));
        const syncsBefore = this.providerSyncs.map((row) => ({ ...row }));
        try {
          await callback(this.client);
        } catch (error) {
          this.grants = grantsBefore;
          this.providerSyncs = syncsBefore;
          throw error;
        }
      },
    } as unknown as AppDb;
  }

  private insert(table: unknown) {
    return {
      values: (values: Record<string, unknown>) => ({
        onConflictDoNothing: () => ({
          returning: () => {
            const duplicate = this.events.find(
              (row) =>
                row.source === values.source &&
                row.externalEventId === values.externalEventId &&
                row.deploymentEnvironment === values.deploymentEnvironment
            );
            if (duplicate) return Promise.resolve([]);
            const row: EventRow = {
              id: crypto.randomUUID(),
              source: values.source as string,
              externalEventId: values.externalEventId as string,
              deploymentEnvironment: values.deploymentEnvironment as
                | 'production'
                | 'sandbox',
              processedAt: null,
              processingError: null,
              attemptCount: 0,
              nextAttemptAt: null,
              deadLetteredAt: null,
              userId: (values.userId as string | null) ?? null,
            };
            this.events.push(row);
            return Promise.resolve([{ id: row.id }]);
          },
        }),
        onConflictDoUpdate: (config: { set: Record<string, unknown> }) => {
          if (table === billingProviderSyncs) {
            return {
              returning: () => {
                const userId = values.userId as string;
                const source = values.source as string;
                const environment = values.environment as string;
                const providerSyncedAt = values.providerSyncedAt as Date;
                const ownershipEventAt =
                  (values.ownershipEventAt as Date | undefined) ?? null;
                const ownershipEventId =
                  (values.ownershipEventId as string | undefined) ?? null;
                const ownershipEventPriority =
                  (values.ownershipEventPriority as number | undefined) ?? 0;
                const existing = this.providerSyncs.find(
                  (row) =>
                    row.userId === userId &&
                    row.source === source &&
                    row.environment === environment
                );
                if (ownershipEventAt) {
                  const currentTime = existing?.ownershipEventAt?.getTime();
                  const incomingTime = ownershipEventAt.getTime();
                  const accepted =
                    currentTime == null ||
                    currentTime < incomingTime ||
                    (currentTime === incomingTime &&
                      (existing?.ownershipEventPriority ?? 0) <
                        ownershipEventPriority) ||
                    (currentTime === incomingTime &&
                      (existing?.ownershipEventPriority ?? 0) ===
                        ownershipEventPriority &&
                      (existing?.ownershipEventId ?? '') <
                        (ownershipEventId ?? ''));
                  if (!accepted) {
                    return Promise.resolve([]);
                  }
                  if (existing) {
                    existing.providerSyncedAt = new Date(
                      Math.max(
                        existing.providerSyncedAt.getTime(),
                        providerSyncedAt.getTime()
                      )
                    );
                    existing.ownershipEventAt = ownershipEventAt;
                    existing.ownershipEventId = ownershipEventId;
                    existing.ownershipEventPriority = ownershipEventPriority;
                    existing.ownershipRevoked =
                      values.ownershipRevoked as boolean;
                    existing.customerMissingSince = null;
                    return Promise.resolve([{ id: existing.id }]);
                  }
                } else if (
                  existing &&
                  existing.providerSyncedAt.getTime() >=
                    providerSyncedAt.getTime()
                ) {
                  return Promise.resolve([]);
                }
                if (existing) {
                  existing.providerSyncedAt = providerSyncedAt;
                  existing.customerMissingSince =
                    (values.customerMissingSince as Date | null) ?? null;
                  return Promise.resolve([{ id: existing.id }]);
                }
                const row = {
                  id: crypto.randomUUID(),
                  userId,
                  source,
                  environment,
                  providerSyncedAt,
                  ownershipEventAt,
                  ownershipEventId,
                  ownershipEventPriority,
                  ownershipRevoked:
                    (values.ownershipRevoked as boolean | undefined) ?? false,
                  customerMissingSince:
                    (values.customerMissingSince as Date | null) ?? null,
                };
                this.providerSyncs.push(row);
                return Promise.resolve([{ id: row.id }]);
              },
            };
          }
          if (table !== entitlementGrants) return Promise.resolve();
          if (values.userId === this.failGrantWriteForUserId) {
            throw new Error('grant_write_failed');
          }
          return {
            returning: () => {
              const existing = this.grants.find(
                (row) =>
                  row.source === values.source &&
                  row.externalRef === values.externalRef &&
                  row.environment === values.environment
              );
              if (
                existing &&
                existing.userId !== values.userId &&
                config.set.userId === undefined
              ) {
                return Promise.resolve([]);
              }
              if (existing) {
                Object.assign(existing, config.set);
                return Promise.resolve([{ userId: existing.userId }]);
              }
              const row = {
                id: crypto.randomUUID(),
                userId: values.userId as string,
                source: values.source as string,
                environment: values.environment as 'production' | 'sandbox',
                externalRef: values.externalRef as string,
                entitlementKey: values.entitlementKey as string,
                status: values.status as string,
                providerSyncedAt: values.providerSyncedAt as Date,
                ...values,
              };
              this.grants.push(row);
              return Promise.resolve([{ userId: row.userId }]);
            },
          };
        },
      }),
    };
  }

  private update(table: unknown) {
    return {
      set: (values: Record<string, unknown>) => ({
        where: (expression: unknown) => {
          const params = extractParams(expression);
          if (table === billingWebhookEvents) {
            const row = this.events.find((item) => params.includes(item.id));
            if (row) {
              if ('attemptCount' in values) row.attemptCount += 1;
              const nextValues = { ...values };
              // Retryable failures use a SQL CASE expression for the eventual
              // dead-letter timestamp. This in-memory DB is always below the
              // attempt ceiling in those tests, so model the expression as
              // NULL instead of treating the SQL object as a terminal date.
              if (
                nextValues.deadLetteredAt !== null &&
                !(nextValues.deadLetteredAt instanceof Date)
              ) {
                nextValues.deadLetteredAt = null;
              }
              Object.assign(row, {
                ...nextValues,
                attemptCount: row.attemptCount,
              });
            }
          } else if (table === entitlementGrants) {
            for (const row of this.grants) {
              if (
                params.includes(row.userId) &&
                params.includes(row.source) &&
                params.includes(row.environment)
              ) {
                Object.assign(row, values);
              }
            }
          } else if (table === billingProviderSyncs) {
            const row = this.providerSyncs.find(
              (item) =>
                params.includes(item.userId) &&
                params.includes(item.source) &&
                params.includes(item.environment)
            );
            if (row && 'customerMissingSince' in values) {
              row.customerMissingSince =
                values.customerMissingSince as Date | null;
            }
          }
          return Promise.resolve();
        },
      }),
    };
  }

  private select() {
    return {
      from: (table: unknown) => ({
        where: (expression: unknown) => {
          const params = extractParams(expression);
          if (table === userProfiles) {
            return Promise.resolve(
              [...this.existingUserIds]
                .filter((userId) => params.includes(userId))
                .map((userId) => ({ userId }))
            );
          }
          if (table === billingProviderSyncs) {
            return {
              limit: () => {
                const row = this.providerSyncs.find(
                  (item) =>
                    params.includes(item.userId) &&
                    params.includes(item.source) &&
                    params.includes(item.environment)
                );
                return Promise.resolve(row ? [{ ...row }] : []);
              },
            };
          }
          return {
            limit: () => {
              const row = this.events.find(
                (item) =>
                  params.includes(item.source) &&
                  params.includes(item.externalEventId) &&
                  params.includes(item.deploymentEnvironment)
              );
              return Promise.resolve(
                row
                  ? [
                      {
                        id: row.id,
                        processedAt: row.processedAt,
                        deadLetteredAt: row.deadLetteredAt,
                      },
                    ]
                  : []
              );
            },
          };
        },
      }),
    };
  }
}

function extractParams(expression: unknown): unknown[] {
  const output: unknown[] = [];
  const seen = new Set<unknown>();
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    const object = node as Record<string, unknown>;
    if (object.constructor?.name === 'Param' && 'value' in object) {
      output.push(object.value);
    }
    if (Array.isArray(object.queryChunks)) object.queryChunks.forEach(walk);
    if (Array.isArray(node)) node.forEach(walk);
  };
  walk(expression);
  return output;
}

function snapshot(
  userId: string,
  environment: 'production' | 'sandbox' = 'production'
): RevenueCatSnapshot {
  return {
    providerSyncedAt: fixedNow,
    environment,
    providerCustomerId: userId,
    grants: [
      {
        entitlementKey: 'premium',
        externalRef: `customer:${userId}:premium`,
        productId: 'kallo_premium_monthly',
        store: 'app_store',
        startsAt: new Date('2026-07-01T00:00:00.000Z'),
        expiresAt: new Date('2026-08-01T00:00:00.000Z'),
        willRenew: true,
        managementUrl: 'https://apps.apple.com/account/subscriptions',
      },
    ],
  };
}

function body(overrides: Record<string, unknown> = {}) {
  return {
    event: {
      id: crypto.randomUUID(),
      type: 'INITIAL_PURCHASE',
      event_timestamp_ms: fixedNow.getTime(),
      app_id: 'app_test',
      app_user_id: USER_ID,
      environment: 'PRODUCTION',
      ...overrides,
    },
  };
}

function request(payload: unknown, authorization = SECRET, hmac?: string) {
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const headers = new Headers({ authorization });
  if (hmac) headers.set('x-revenuecat-webhook-signature', hmac);
  return new Request('https://app.test/api/webhooks/revenuecat', {
    method: 'POST',
    headers,
    body: raw,
  });
}

const originalEnv = { ...process.env };
let database: InMemoryDb;

beforeEach(() => {
  database = new InMemoryDb();
  process.env.REVENUECAT_WEBHOOK_SECRET = SECRET;
  process.env.REVENUECAT_ALLOWED_APP_IDS = 'app_test';
  delete process.env.REVENUECAT_WEBHOOK_HMAC_SECRET;
  delete process.env.REVENUECAT_INFER_MISSING_EVENT_ENVIRONMENT;
  process.env.REVENUECAT_ALLOW_OWNERSHIP_TRANSFER = 'true';
  delete process.env.BILLING_ENFORCEMENT_ENABLED;
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

function post(
  payload: unknown,
  fetchSnapshot: WebhookFetchSnapshot | undefined = undefined,
  billingEnvironment: 'production' | 'sandbox' = 'production'
) {
  const snapshotFetcher =
    fetchSnapshot ??
    vi.fn(async (userId: string, environment: 'production' | 'sandbox') =>
      snapshot(userId, environment)
    );
  return handleRevenueCatWebhook(request(payload), {
    db: database.client,
    now: () => fixedNow,
    fetchSnapshot: snapshotFetcher,
    billingEnvironment,
  });
}

type WebhookFetchSnapshot = (
  userId: string,
  environment: 'production' | 'sandbox'
) => Promise<RevenueCatSnapshot>;

describe('RevenueCat webhook authentication and parsing', () => {
  it('rejects a wrong bearer secret', async () => {
    const response = await handleRevenueCatWebhook(request(body(), 'wrong'), {
      db: database.client,
      now: () => fixedNow,
      billingEnvironment: 'production',
    });
    expect(response.status).toBe(401);
  });

  it('verifies an HMAC over the exact raw body and rejects stale signatures', async () => {
    const payload = body({ type: 'TEST' });
    const raw = JSON.stringify(payload);
    const timestamp = Math.floor(fixedNow.getTime() / 1000).toString();
    process.env.REVENUECAT_WEBHOOK_HMAC_SECRET = 'hmac-secret';
    const signature = createHmac('sha256', 'hmac-secret')
      .update(`${timestamp}.${raw}`)
      .digest('hex');
    const valid = await handleRevenueCatWebhook(
      request(payload, SECRET, `t=${timestamp},v1=${signature}`),
      {
        db: database.client,
        now: () => fixedNow,
        billingEnvironment: 'production',
      }
    );
    expect(valid.status).toBe(200);

    const staleTimestamp = `${Number(timestamp) - 301}`;
    const staleSignature = createHmac('sha256', 'hmac-secret')
      .update(`${staleTimestamp}.${raw}`)
      .digest('hex');
    const stale = await handleRevenueCatWebhook(
      request(payload, SECRET, `t=${staleTimestamp},v1=${staleSignature}`),
      {
        db: database.client,
        now: () => fixedNow,
        billingEnvironment: 'production',
      }
    );
    expect(stale.status).toBe(401);
  });

  it('rejects malformed JSON and incomplete envelopes', async () => {
    expect((await post('{ bad json')).status).toBe(400);
    expect((await post({ event: { id: 'missing-fields' } })).status).toBe(400);
  });

  it('rejects an oversized body before parsing or audit storage', async () => {
    const response = await handleRevenueCatWebhook(
      request('x'.repeat(300 * 1024)),
      {
        db: database.client,
        now: () => fixedNow,
        billingEnvironment: 'production',
      }
    );
    expect(response.status).toBe(413);
    expect(database.events).toHaveLength(0);
  });

  it('rejects events from a RevenueCat app outside the configured project', async () => {
    process.env.REVENUECAT_ALLOWED_APP_IDS = 'app_expected,app_other';
    const response = await post(body({ app_id: 'app_wrong' }));
    expect(response.status).toBe(401);
    expect(database.events).toHaveLength(0);
  });

  it('rejects entitlement events missing app_id when allowlisting is on', async () => {
    process.env.REVENUECAT_ALLOWED_APP_IDS = 'app_expected';
    const response = await post(body({ app_id: undefined }));
    expect(response.status).toBe(401);
    expect(database.events).toHaveLength(0);
  });

  it('requires the app allowlist for every grant-mutating webhook', async () => {
    delete process.env.REVENUECAT_ALLOWED_APP_IDS;
    const response = await post(body());
    expect(response.status).toBe(503);
    expect(database.events).toHaveLength(0);
  });
});

describe('RevenueCat webhook reconciliation', () => {
  it('dead-letters transfers unless ownership migration is explicitly enabled', async () => {
    process.env.REVENUECAT_ALLOW_OWNERSHIP_TRANSFER = 'false';
    const response = await post(
      body({
        type: 'TRANSFER',
        transferred_from: [USER_ID],
        transferred_to: [OTHER_USER_ID],
      })
    );

    expect(response.status).toBe(500);
    expect(database.events[0]?.processingError).toBe(
      'ownership_transfer_disabled'
    );
    expect(database.events[0]?.deadLetteredAt).toEqual(fixedNow);
    expect(database.grants).toHaveLength(0);
  });

  it('retains a transfer with no environment for operator-safe retry', async () => {
    database.grants.push({
      id: crypto.randomUUID(),
      userId: USER_ID,
      source: 'revenuecat',
      environment: 'production',
      externalRef: `customer:${USER_ID}:premium`,
      entitlementKey: 'premium',
      status: 'active',
      providerSyncedAt: new Date('2026-07-12T00:00:00.000Z'),
    });

    const response = await post(
      body({
        type: 'TRANSFER',
        environment: undefined,
        transferred_from: [USER_ID],
        transferred_to: [OTHER_USER_ID],
      })
    );

    expect(response.status).toBe(500);
    expect(database.grants).toHaveLength(1);
    expect(database.grants[0]?.status).toBe('active');
    expect(database.events[0]?.processingError).toBe(
      'missing_event_environment'
    );
    expect(database.events[0]?.deadLetteredAt).toBeNull();
    expect(database.events[0]?.nextAttemptAt).not.toBeNull();
  });

  it('infers a missing transfer environment only when explicitly trusted', async () => {
    process.env.REVENUECAT_INFER_MISSING_EVENT_ENVIRONMENT = 'true';
    database.grants.push({
      id: crypto.randomUUID(),
      userId: USER_ID,
      source: 'revenuecat',
      environment: 'production',
      externalRef: `customer:${USER_ID}:premium`,
      entitlementKey: 'premium',
      status: 'active',
      providerSyncedAt: new Date('2026-07-12T00:00:00.000Z'),
    });

    const response = await post(
      body({
        type: 'TRANSFER',
        environment: undefined,
        transferred_from: [USER_ID],
        transferred_to: [OTHER_USER_ID],
      })
    );

    expect(response.status).toBe(200);
    expect(
      database.grants.find((grant) => grant.userId === OTHER_USER_ID)?.status
    ).toBe('active');
  });

  it('does not reprocess a permanently dead-lettered redelivery', async () => {
    const payload = body({
      id: 'invalid-environment-transfer',
      type: 'TRANSFER',
      environment: 'UNKNOWN',
      transferred_from: [USER_ID],
      transferred_to: [OTHER_USER_ID],
    });

    expect((await post(payload)).status).toBe(500);
    const redelivery = await post(payload);

    expect(redelivery.status).toBe(200);
    expect(await redelivery.json()).toEqual({
      received: true,
      duplicate: true,
    });
    expect(database.events[0]?.attemptCount).toBe(1);
  });

  it('expires the transfer source and reconciles only one destination', async () => {
    database.grants.push({
      id: crypto.randomUUID(),
      userId: USER_ID,
      source: 'revenuecat',
      environment: 'production',
      externalRef: `customer:${USER_ID}:premium`,
      entitlementKey: 'premium',
      status: 'active',
      providerSyncedAt: new Date('2026-07-12T00:00:00.000Z'),
    });
    const fetchSnapshot = vi.fn(async (userId: string) => snapshot(userId));
    const response = await post(
      body({
        type: 'TRANSFER',
        app_user_id: EXTRA_USER_ID,
        aliases: [EXTRA_USER_ID],
        transferred_from: [USER_ID],
        transferred_to: [OTHER_USER_ID],
      }),
      fetchSnapshot
    );
    expect(
      response.status,
      database.events[0]?.processingError ?? undefined
    ).toBe(200);
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    expect(fetchSnapshot).toHaveBeenCalledWith(OTHER_USER_ID, 'production');
    expect(
      database.grants.find((grant) => grant.userId === USER_ID)?.status
    ).toBe('expired');
    expect(
      database.grants.find((grant) => grant.userId === OTHER_USER_ID)?.status
    ).toBe('active');
  });

  it('ignores an older distinct transfer after a newer transfer-back', async () => {
    database.grants.push({
      id: crypto.randomUUID(),
      userId: USER_ID,
      source: 'revenuecat',
      environment: 'production',
      externalRef: `customer:${USER_ID}:premium`,
      entitlementKey: 'premium',
      status: 'active',
      providerSyncedAt: new Date('2026-07-10T00:00:00.000Z'),
    });

    const newerTransferBack = await post(
      body({
        id: 'transfer-back-t2',
        type: 'TRANSFER',
        event_timestamp_ms: new Date('2026-07-12T00:00:00.000Z').getTime(),
        app_user_id: undefined,
        transferred_from: [OTHER_USER_ID],
        transferred_to: [USER_ID],
      })
    );
    expect(newerTransferBack.status).toBe(200);

    const staleTransferAway = await post(
      body({
        id: 'transfer-away-t1',
        type: 'TRANSFER',
        event_timestamp_ms: new Date('2026-07-11T00:00:00.000Z').getTime(),
        app_user_id: undefined,
        transferred_from: [USER_ID],
        transferred_to: [OTHER_USER_ID],
      })
    );

    expect(staleTransferAway.status).toBe(200);
    expect(
      database.grants.find((grant) => grant.userId === USER_ID)?.status
    ).toBe('active');
    expect(
      database.grants.some(
        (grant) => grant.userId === OTHER_USER_ID && grant.status === 'active'
      )
    ).toBe(false);
    expect(
      database.providerSyncs.find((sync) => sync.userId === USER_ID)
        ?.ownershipEventAt
    ).toEqual(new Date('2026-07-12T00:00:00.000Z'));
  });

  it('lets a paired transfer outrank redemption at the same timestamp', async () => {
    const sharedExternalRef = 'original-transaction-shared';
    database.grants.push({
      id: crypto.randomUUID(),
      userId: USER_ID,
      source: 'revenuecat',
      environment: 'production',
      externalRef: sharedExternalRef,
      entitlementKey: 'premium',
      status: 'active',
      providerSyncedAt: new Date('2026-07-10T00:00:00.000Z'),
    });
    const pairedAt = new Date('2026-07-12T12:00:00.000Z').getTime();
    const fetchSnapshot = vi.fn(async (userId: string) => {
      const current = snapshot(userId);
      const grant = current.grants[0];
      if (grant) grant.externalRef = sharedExternalRef;
      return current;
    });

    expect(
      (
        await post(
          body({
            id: 'paired-redemption',
            type: 'PURCHASE_REDEEMED',
            redemption_outcome: 'transfer',
            event_timestamp_ms: pairedAt,
            app_user_id: OTHER_USER_ID,
            original_app_user_id: USER_ID,
            redeemed_from: [USER_ID],
            redeemed_by: [OTHER_USER_ID],
          }),
          fetchSnapshot
        )
      ).status
    ).toBe(200);
    expect(database.grants[0]?.userId).toBe(USER_ID);

    expect(
      (
        await post(
          body({
            id: 'paired-transfer',
            type: 'TRANSFER',
            event_timestamp_ms: pairedAt,
            app_user_id: undefined,
            transferred_from: [USER_ID],
            transferred_to: [OTHER_USER_ID],
          }),
          fetchSnapshot
        )
      ).status
    ).toBe(200);
    expect(database.grants[0]?.userId).toBe(OTHER_USER_ID);
    expect(database.grants[0]?.status).toBe('active');
  });

  it('fails closed when a transfer names multiple live destinations', async () => {
    const response = await post(
      body({
        type: 'TRANSFER',
        app_user_id: undefined,
        transferred_from: [USER_ID],
        transferred_to: [OTHER_USER_ID, EXTRA_USER_ID],
      })
    );

    expect(response.status).toBe(500);
    expect(database.grants).toHaveLength(0);
    expect(database.events[0]?.processingError).toBe(
      'ambiguous_transfer_destination'
    );
  });

  it('rolls back every user when one transfer grant write fails', async () => {
    database.failGrantWriteForUserId = OTHER_USER_ID;
    const response = await post(
      body({
        type: 'TRANSFER',
        app_user_id: undefined,
        transferred_from: [USER_ID],
        transferred_to: [OTHER_USER_ID],
      })
    );

    expect(response.status).toBe(500);
    expect(database.grants).toHaveLength(0);
    expect(database.providerSyncs).toHaveLength(0);
    expect(database.events[0]?.processedAt).toBeNull();
    expect(database.events[0]?.processingError).toBe('grant_write_failed');
  });

  it('skips a deleted transfer source and reconciles the existing destination', async () => {
    database.existingUserIds.delete(USER_ID);
    const fetchSnapshot = vi.fn(async (userId: string) => snapshot(userId));
    const response = await post(
      body({
        type: 'TRANSFER',
        app_user_id: undefined,
        transferred_from: [USER_ID],
        transferred_to: [OTHER_USER_ID],
      }),
      fetchSnapshot
    );

    expect(response.status).toBe(200);
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    expect(fetchSnapshot).toHaveBeenCalledWith(OTHER_USER_ID, 'production');
    expect(database.grants.map((grant) => grant.userId)).toEqual([
      OTHER_USER_ID,
    ]);
  });

  it('prefers the current redeemer over the original purchaser', async () => {
    const fetchSnapshot = vi.fn(async (userId: string) => snapshot(userId));
    const response = await post(
      body({
        type: 'PURCHASE_REDEEMED',
        redemption_outcome: 'alias',
        app_user_id: OTHER_USER_ID,
        redeemed_from: [OTHER_USER_ID],
        redeemed_by: [USER_ID],
      }),
      fetchSnapshot
    );
    expect(response.status).toBe(200);
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    expect(fetchSnapshot).toHaveBeenCalledWith(USER_ID, 'production');
    expect(database.grants[0]?.userId).toBe(USER_ID);
  });

  it('never grants a redemption that omits redeemed_by', async () => {
    const fetchSnapshot = vi.fn(async (userId: string) => snapshot(userId));
    const response = await post(
      body({
        type: 'PURCHASE_REDEEMED',
        redemption_outcome: 'alias',
        app_user_id: USER_ID,
        redeemed_from: [USER_ID],
        redeemed_by: undefined,
      }),
      fetchSnapshot
    );

    expect(response.status).toBe(500);
    expect(fetchSnapshot).not.toHaveBeenCalled();
    expect(database.events[0]?.processingError).toBe(
      'unresolvable_redemption_destination'
    );
  });

  it('dead-letters a redemption that attempts to move an owned receipt', async () => {
    const externalRef = 'owned-receipt';
    database.grants.push({
      id: crypto.randomUUID(),
      userId: USER_ID,
      source: 'revenuecat',
      environment: 'production',
      externalRef,
      entitlementKey: 'premium',
      status: 'active',
      providerSyncedAt: new Date('2026-07-10T00:00:00.000Z'),
    });
    const fetchSnapshot = vi.fn(async (userId: string) => {
      const current = snapshot(userId);
      const grant = current.grants[0];
      if (grant) grant.externalRef = externalRef;
      return current;
    });

    const response = await post(
      body({
        type: 'PURCHASE_REDEEMED',
        redemption_outcome: 'alias',
        app_user_id: OTHER_USER_ID,
        redeemed_from: [USER_ID],
        redeemed_by: [OTHER_USER_ID],
      }),
      fetchSnapshot
    );

    expect(response.status).toBe(500);
    expect(database.grants[0]?.userId).toBe(USER_ID);
    expect(database.events[0]?.processingError).toBe(
      'revenuecat_ownership_conflict'
    );
    expect(database.events[0]?.deadLetteredAt).toEqual(fixedNow);
  });

  it('defers transfer-outcome redemption to the paired transfer event', async () => {
    const fetchSnapshot = vi.fn(async (userId: string) => snapshot(userId));
    const response = await post(
      body({
        type: 'PURCHASE_REDEEMED',
        redemption_outcome: 'transfer',
        redeemed_from: [USER_ID],
        redeemed_by: [OTHER_USER_ID],
      }),
      fetchSnapshot
    );

    expect(response.status).toBe(200);
    expect(fetchSnapshot).not.toHaveBeenCalled();
    expect(database.events[0]?.processingError).toBe(
      'redemption_transfer_deferred'
    );
    expect(database.grants).toHaveLength(0);
  });

  it('uses aliases to recover an anonymous event', async () => {
    const response = await post(
      body({
        app_user_id: '$RCAnonymousID:mobile',
        original_app_user_id: '$RCAnonymousID:mobile',
        aliases: [USER_ID],
      })
    );
    expect(response.status).toBe(200);
    expect(database.grants[0]?.userId).toBe(USER_ID);
  });

  it('does not grant a standard lifecycle event to every live alias', async () => {
    const fetchSnapshot = vi.fn(async (userId: string) => snapshot(userId));
    const response = await post(
      body({
        app_user_id: USER_ID,
        original_app_user_id: OTHER_USER_ID,
        aliases: [OTHER_USER_ID],
      }),
      fetchSnapshot
    );

    expect(response.status).toBe(200);
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    expect(fetchSnapshot).toHaveBeenCalledWith(USER_ID, 'production');
    expect(database.grants.map((grant) => grant.userId)).toEqual([USER_ID]);
  });

  it('fails closed when only multiple live aliases can resolve ownership', async () => {
    const response = await post(
      body({
        app_user_id: '$RCAnonymousID:mobile',
        original_app_user_id: OTHER_USER_ID,
        aliases: [USER_ID, OTHER_USER_ID],
      })
    );

    expect(response.status).toBe(500);
    expect(database.grants).toHaveLength(0);
    expect(database.events[0]?.processingError).toBe('ambiguous_user');
  });

  it('falls through a deleted primary id to an existing alias', async () => {
    database.existingUserIds.delete(OTHER_USER_ID);
    const fetchSnapshot = vi.fn(async (userId: string) => snapshot(userId));
    const response = await post(
      body({
        app_user_id: OTHER_USER_ID,
        original_app_user_id: OTHER_USER_ID,
        aliases: [USER_ID],
      }),
      fetchSnapshot
    );

    expect(response.status).toBe(200);
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    expect(fetchSnapshot).toHaveBeenCalledWith(USER_ID, 'production');
    expect(database.grants.map((grant) => grant.userId)).toEqual([USER_ID]);
  });

  it('finalizes an event whose only local user was deleted', async () => {
    database.existingUserIds.delete(USER_ID);
    const fetchSnapshot = vi.fn(async (userId: string) => snapshot(userId));
    const response = await post(body(), fetchSnapshot);

    expect(response.status).toBe(200);
    expect(fetchSnapshot).not.toHaveBeenCalled();
    expect(database.events[0]?.processedAt).toEqual(fixedNow);
    expect(database.events[0]?.processingError).toBe('orphaned_user');
    expect(database.events[0]?.userId).toBeNull();
  });

  it('dead-letters permanently unresolvable purchases', async () => {
    const response = await post(
      body({
        app_user_id: '$RCAnonymousID:only',
        aliases: ['$RCAnonymousID:only'],
      })
    );
    expect(response.status).toBe(500);
    expect(database.events[0]?.processedAt).toBeNull();
    expect(database.events[0]?.processingError).toBe('unresolvable_user');
    expect(database.events[0]?.deadLetteredAt).toEqual(fixedNow);
  });

  it('retries an existing failed event and finalizes only after success', async () => {
    const payload = body({ id: 'retry-me' });
    const failed = await post(
      payload,
      vi.fn(async () => {
        throw new Error('revenuecat_http_503');
      })
    );
    expect(failed.status).toBe(500);
    expect(database.events[0]?.processedAt).toBeNull();

    const recovered = await post(payload);
    expect(recovered.status).toBe(200);
    expect(database.events).toHaveLength(1);
    expect(database.events[0]?.processedAt).toEqual(fixedNow);
    expect(database.events[0]?.attemptCount).toBe(2);
  });

  it('treats a processed redelivery as a duplicate', async () => {
    const payload = body({ id: 'duplicate' });
    expect((await post(payload)).status).toBe(200);
    const second = await post(payload);
    expect(await second.json()).toEqual({ received: true, duplicate: true });
    expect(database.grants).toHaveLength(1);
  });

  it('strictly separates production and sandbox events', async () => {
    const response = await post(
      body({ environment: 'SANDBOX' }),
      undefined,
      'production'
    );
    expect(response.status).toBe(200);
    expect(database.grants).toHaveLength(0);
    expect(database.events[0]?.processingError).toBe(
      'environment_ignored:sandbox'
    );
    expect(database.events[0]?.userId).toBeNull();
  });

  it('does not expire the same user grant from the other environment', async () => {
    database.grants.push({
      id: crypto.randomUUID(),
      userId: USER_ID,
      source: 'revenuecat',
      environment: 'sandbox',
      externalRef: `customer:${USER_ID}:premium`,
      entitlementKey: 'premium',
      status: 'active',
      providerSyncedAt: new Date('2026-07-12T00:00:00.000Z'),
    });

    const response = await post(body({ environment: 'PRODUCTION' }));

    expect(response.status).toBe(200);
    expect(
      database.grants.find((grant) => grant.environment === 'sandbox')?.status
    ).toBe('active');
    expect(
      database.grants.find((grant) => grant.environment === 'production')
        ?.status
    ).toBe('active');
  });

  it.each([
    {
      providerEnvironment: 'SANDBOX' as const,
      firstDeployment: 'production' as const,
      secondDeployment: 'sandbox' as const,
    },
    {
      providerEnvironment: 'PRODUCTION' as const,
      firstDeployment: 'sandbox' as const,
      secondDeployment: 'production' as const,
    },
  ])('does not let $firstDeployment suppress the same event in $secondDeployment', async ({
    providerEnvironment,
    firstDeployment,
    secondDeployment,
  }) => {
    const payload = body({
      id: `shared-${providerEnvironment.toLowerCase()}`,
      environment: providerEnvironment,
    });

    expect((await post(payload, undefined, firstDeployment)).status).toBe(200);
    expect(database.grants).toHaveLength(0);

    expect((await post(payload, undefined, secondDeployment)).status).toBe(200);
    expect(database.events).toHaveLength(2);
    expect(
      database.events.map((event) => event.deploymentEnvironment).sort()
    ).toEqual(['production', 'sandbox']);
    expect(database.grants).toHaveLength(1);
    expect(database.grants[0]?.environment).toBe(secondDeployment);
  });

  it('reconciles future lifecycle types instead of hard-coding a reducer', async () => {
    const fetchSnapshot = vi.fn(async (userId: string) => snapshot(userId));
    const response = await post(
      body({ type: 'FUTURE_SUBSCRIPTION_EVENT' }),
      fetchSnapshot
    );
    expect(response.status).toBe(200);
    expect(fetchSnapshot).toHaveBeenCalledWith(USER_ID, 'production');
  });

  it('records informational events without calling CustomerInfo', async () => {
    const fetchSnapshot = vi.fn(async (userId: string) => snapshot(userId));
    const response = await post(
      body({ type: 'PAYWALL_IMPRESSION' }),
      fetchSnapshot
    );
    expect(response.status).toBe(200);
    expect(fetchSnapshot).not.toHaveBeenCalled();
    expect(database.events[0]?.processingError).toBe('informational_event');
    expect(database.events[0]?.userId).toBeNull();
  });
});
