import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AppDb } from '@/lib/db';
import { billingWebhookEvents, entitlementGrants } from '@/lib/db/schema';
import { POST } from '../route';

// Realistic RC webhook payloads modelled on the current docs:
// https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields

const SECRET = 'test-webhook-secret';
const USER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_USER_ID = '22222222-2222-2222-2222-222222222222';
const fixedNow = new Date('2026-06-01T00:00:00.000Z');
const now = () => fixedNow;

interface WebhookEventRow {
  id: string;
  source: string;
  externalEventId: string;
  eventType: string;
  userId: string | null;
  rawPayload: unknown;
  processedAt: Date | null;
  processingError: string | null;
  createdAt: Date;
}

interface GrantRow {
  id: string;
  userId: string;
  entitlementKey: string;
  source: string;
  productId: string | null;
  startsAt: Date;
  expiresAt: Date | null;
  status: string;
  willRenew: boolean;
  externalRef: string;
  createdAt: Date;
  updatedAt: Date;
}

// Minimal in-memory Drizzle stub covering exactly the calls the route makes:
//   insert(events).values().onConflictDoNothing().returning()
//   insert(grants).values().onConflictDoUpdate()
//   update(events|grants).set().where()
// where() is passed the drizzle expression; we can't introspect it cheaply,
// so update targeting is resolved by table + a captured predicate closure.
class InMemoryDb {
  events: WebhookEventRow[] = [];
  grants: GrantRow[] = [];

  get client(): AppDb {
    return {
      insert: (table: unknown) => this.buildInsert(table),
      update: (table: unknown) => this.buildUpdate(table),
    } as unknown as AppDb;
  }

  private buildInsert(table: unknown) {
    return {
      values: (values: Record<string, unknown>) => ({
        // Events insert path.
        onConflictDoNothing: (_config: unknown) => ({
          returning: (_cols: unknown) => {
            const externalEventId = values.externalEventId as string;
            const exists = this.events.some(
              (e) => e.externalEventId === externalEventId
            );
            if (exists) return Promise.resolve([]);
            const row: WebhookEventRow = {
              id: crypto.randomUUID(),
              source: values.source as string,
              externalEventId,
              eventType: values.eventType as string,
              userId: (values.userId as string | null) ?? null,
              rawPayload: values.rawPayload,
              processedAt: null,
              processingError: null,
              createdAt: values.createdAt as Date,
            };
            this.events.push(row);
            return Promise.resolve([{ id: row.id }]);
          },
        }),
        // Grants upsert path.
        onConflictDoUpdate: (config: { set: Record<string, unknown> }) => {
          if (table === entitlementGrants) {
            const externalRef = values.externalRef as string;
            const source = values.source as string;
            const existing = this.grants.find(
              (g) => g.source === source && g.externalRef === externalRef
            );
            if (existing) {
              Object.assign(existing, config.set);
            } else {
              this.grants.push({
                id: crypto.randomUUID(),
                userId: values.userId as string,
                entitlementKey: values.entitlementKey as string,
                source,
                productId: (values.productId as string | null) ?? null,
                startsAt: values.startsAt as Date,
                expiresAt: (values.expiresAt as Date | null) ?? null,
                status: values.status as string,
                willRenew: values.willRenew as boolean,
                externalRef,
                createdAt: values.createdAt as Date,
                updatedAt: values.updatedAt as Date,
              });
            }
          }
          return Promise.resolve();
        },
      }),
    };
  }

  private buildUpdate(table: unknown) {
    return {
      set: (set: Record<string, unknown>) => ({
        // The route builds the where clause with drizzle eq()/and(); we can't
        // read that structurally, so we pull the bound Param values out of the
        // expression and match rows against them (event id, or grant
        // source+externalRef).
        where: (expr: unknown) => {
          const params = extractParams(expr);
          if (table === billingWebhookEvents) {
            const row = this.events.find((e) => params.includes(e.id));
            if (row) Object.assign(row, set);
          } else if (table === entitlementGrants) {
            for (const g of this.grants) {
              if (params.includes(g.source) && params.includes(g.externalRef)) {
                Object.assign(g, set);
              }
            }
          }
          return Promise.resolve();
        },
      }),
    };
  }
}

// Walk a drizzle SQL expression (eq/and produce nested queryChunks) and
// collect the bound Param values so the stub can resolve update targets.
function extractParams(expr: unknown): unknown[] {
  const out: unknown[] = [];
  const seen = new Set<unknown>();
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    const obj = node as Record<string, unknown>;
    if (obj.constructor?.name === 'Param' && 'value' in obj) {
      out.push(obj.value);
    }
    if (Array.isArray(obj.queryChunks)) obj.queryChunks.forEach(walk);
    if (Array.isArray(node)) (node as unknown[]).forEach(walk);
  };
  walk(expr);
  return out;
}

function baseEvent(overrides: Record<string, unknown>) {
  return {
    event: {
      id: overrides.id ?? crypto.randomUUID(),
      type: overrides.type,
      app_user_id: overrides.app_user_id ?? USER_ID,
      environment: overrides.environment ?? 'PRODUCTION',
      store: 'APP_STORE',
      ...overrides,
    },
  };
}

function makeRequest(body: unknown, header: string | null = SECRET): Request {
  const headers = new Headers();
  if (header !== null) headers.set('authorization', header);
  return new Request('https://app.test/api/webhooks/revenuecat', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const originalEnv = { ...process.env };
let dbStub: InMemoryDb;

beforeEach(() => {
  process.env.REVENUECAT_WEBHOOK_SECRET = SECRET;
  dbStub = new InMemoryDb();
});

afterEach(() => {
  process.env = { ...originalEnv };
});

function post(body: unknown, header: string | null = SECRET, isProd = true) {
  return POST(makeRequest(body, header), {
    db: dbStub.client,
    now,
    isProduction: isProd,
  });
}

describe('RevenueCat webhook — auth', () => {
  it('401 on wrong authorization header', async () => {
    const res = await post(baseEvent({ type: 'TEST' }), 'wrong-secret');
    expect(res.status).toBe(401);
  });

  it('401 on missing authorization header', async () => {
    const res = await post(baseEvent({ type: 'TEST' }), null);
    expect(res.status).toBe(401);
  });

  it('503 when the webhook secret is not configured', async () => {
    delete process.env.REVENUECAT_WEBHOOK_SECRET;
    const res = await post(baseEvent({ type: 'TEST' }), 'anything');
    expect(res.status).toBe(503);
  });
});

describe('RevenueCat webhook — parsing', () => {
  it('400 on malformed JSON', async () => {
    const res = await post('{ not json', SECRET);
    expect(res.status).toBe(400);
  });
});

describe('RevenueCat webhook — idempotency', () => {
  it('duplicate event id → 200 duplicate, no second grant mutation', async () => {
    const event = baseEvent({
      id: 'evt_dup',
      type: 'INITIAL_PURCHASE',
      product_id: 'nham_premium_monthly',
      original_transaction_id: 'otx_1',
      purchased_at_ms: fixedNow.getTime(),
      expiration_at_ms: fixedNow.getTime() + 30 * 86_400_000,
    });

    const first = await post(event);
    expect(first.status).toBe(200);
    expect(dbStub.grants).toHaveLength(1);

    const second = await post(event);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ received: true, duplicate: true });
    // Still exactly one webhook event row and one grant.
    expect(dbStub.events).toHaveLength(1);
    expect(dbStub.grants).toHaveLength(1);
  });
});

describe('RevenueCat webhook — grant lifecycle', () => {
  const monthlyExpiry = fixedNow.getTime() + 30 * 86_400_000;

  it('INITIAL_PURCHASE creates an active grant with the right expiry', async () => {
    const res = await post(
      baseEvent({
        id: 'evt_init',
        type: 'INITIAL_PURCHASE',
        product_id: 'nham_premium_monthly',
        original_transaction_id: 'otx_1',
        purchased_at_ms: fixedNow.getTime(),
        expiration_at_ms: monthlyExpiry,
      })
    );

    expect(res.status).toBe(200);
    const grant = dbStub.grants[0];
    expect(grant).toMatchObject({
      userId: USER_ID,
      entitlementKey: 'premium',
      source: 'revenuecat',
      status: 'active',
      willRenew: true,
      externalRef: 'otx_1',
    });
    expect(grant.expiresAt?.getTime()).toBe(monthlyExpiry);
    // Event marked processed with no error.
    expect(dbStub.events[0].processedAt).toEqual(fixedNow);
    expect(dbStub.events[0].processingError).toBeNull();
  });

  it('RENEWAL updates the same (source, externalRef) row instead of stacking', async () => {
    const newExpiry = monthlyExpiry + 30 * 86_400_000;
    await post(
      baseEvent({
        id: 'evt_init2',
        type: 'INITIAL_PURCHASE',
        product_id: 'nham_premium_monthly',
        original_transaction_id: 'otx_2',
        purchased_at_ms: fixedNow.getTime(),
        expiration_at_ms: monthlyExpiry,
      })
    );
    await post(
      baseEvent({
        id: 'evt_renew',
        type: 'RENEWAL',
        product_id: 'nham_premium_monthly',
        original_transaction_id: 'otx_2',
        purchased_at_ms: monthlyExpiry,
        expiration_at_ms: newExpiry,
      })
    );

    expect(dbStub.grants).toHaveLength(1);
    expect(dbStub.grants[0].expiresAt?.getTime()).toBe(newExpiry);
    expect(dbStub.grants[0].status).toBe('active');
  });

  it('NON_RENEWING_PURCHASE lifetime → expiresAt null, willRenew false', async () => {
    await post(
      baseEvent({
        id: 'evt_life',
        type: 'NON_RENEWING_PURCHASE',
        product_id: 'nham_premium_lifetime',
        transaction_id: 'txn_life',
        purchased_at_ms: fixedNow.getTime(),
      })
    );

    const grant = dbStub.grants[0];
    expect(grant.expiresAt).toBeNull();
    expect(grant.willRenew).toBe(false);
    expect(grant.status).toBe('active');
    expect(grant.externalRef).toBe('txn_life');
  });

  it('CANCELLATION (UNSUBSCRIBE) keeps access: willRenew false, status active', async () => {
    await post(
      baseEvent({
        id: 'evt_init3',
        type: 'INITIAL_PURCHASE',
        product_id: 'nham_premium_monthly',
        original_transaction_id: 'otx_3',
        purchased_at_ms: fixedNow.getTime(),
        expiration_at_ms: monthlyExpiry,
      })
    );
    await post(
      baseEvent({
        id: 'evt_cancel',
        type: 'CANCELLATION',
        cancel_reason: 'UNSUBSCRIBE',
        product_id: 'nham_premium_monthly',
        original_transaction_id: 'otx_3',
      })
    );

    const grant = dbStub.grants[0];
    expect(grant.status).toBe('active');
    expect(grant.willRenew).toBe(false);
  });

  it('CANCELLATION (CUSTOMER_SUPPORT) is a refund → status refunded', async () => {
    await post(
      baseEvent({
        id: 'evt_init4',
        type: 'INITIAL_PURCHASE',
        product_id: 'nham_premium_monthly',
        original_transaction_id: 'otx_4',
        purchased_at_ms: fixedNow.getTime(),
        expiration_at_ms: monthlyExpiry,
      })
    );
    await post(
      baseEvent({
        id: 'evt_refund',
        type: 'CANCELLATION',
        cancel_reason: 'CUSTOMER_SUPPORT',
        product_id: 'nham_premium_monthly',
        original_transaction_id: 'otx_4',
      })
    );

    expect(dbStub.grants[0].status).toBe('refunded');
  });

  it('EXPIRATION → status expired', async () => {
    await post(
      baseEvent({
        id: 'evt_init5',
        type: 'INITIAL_PURCHASE',
        product_id: 'nham_premium_monthly',
        original_transaction_id: 'otx_5',
        purchased_at_ms: fixedNow.getTime(),
        expiration_at_ms: monthlyExpiry,
      })
    );
    await post(
      baseEvent({
        id: 'evt_expire',
        type: 'EXPIRATION',
        expiration_reason: 'UNSUBSCRIBE',
        product_id: 'nham_premium_monthly',
        original_transaction_id: 'otx_5',
      })
    );

    expect(dbStub.grants[0].status).toBe('expired');
  });

  it('unknown product → 200, processing_error unknown_product, no grant', async () => {
    const res = await post(
      baseEvent({
        id: 'evt_unknown_prod',
        type: 'INITIAL_PURCHASE',
        product_id: 'not_a_real_product',
        original_transaction_id: 'otx_x',
        purchased_at_ms: fixedNow.getTime(),
        expiration_at_ms: monthlyExpiry,
      })
    );
    expect(res.status).toBe(200);
    expect(dbStub.grants).toHaveLength(0);
    expect(dbStub.events[0].processingError).toBe('unknown_product');
  });

  it('unhandled event type → 200, processing_error unhandled_type', async () => {
    const res = await post(
      baseEvent({ id: 'evt_weird', type: 'PAYWALL_IMPRESSION' })
    );
    expect(res.status).toBe(200);
    expect(dbStub.events[0].processingError).toBe('unhandled_type');
  });
});

describe('RevenueCat webhook — sandbox guard', () => {
  it('sandbox event in production is recorded but does not mutate grants', async () => {
    const res = await post(
      baseEvent({
        id: 'evt_sandbox',
        type: 'INITIAL_PURCHASE',
        environment: 'SANDBOX',
        product_id: 'nham_premium_monthly',
        original_transaction_id: 'otx_sb',
        purchased_at_ms: fixedNow.getTime(),
        expiration_at_ms: fixedNow.getTime() + 30 * 86_400_000,
      }),
      SECRET,
      true // isProduction
    );

    expect(res.status).toBe(200);
    expect(dbStub.grants).toHaveLength(0);
    expect(dbStub.events[0].processingError).toBe('sandbox_ignored');
  });

  it('sandbox event in non-production DOES mutate grants', async () => {
    const res = await post(
      baseEvent({
        id: 'evt_sandbox2',
        type: 'INITIAL_PURCHASE',
        environment: 'SANDBOX',
        product_id: 'nham_premium_monthly',
        original_transaction_id: 'otx_sb2',
        purchased_at_ms: fixedNow.getTime(),
        expiration_at_ms: fixedNow.getTime() + 30 * 86_400_000,
      }),
      SECRET,
      false // non-production
    );

    expect(res.status).toBe(200);
    expect(dbStub.grants).toHaveLength(1);
  });
});

describe('RevenueCat webhook — user resolution', () => {
  it('anonymous app_user_id with no uuid fallback → 200 + unresolvable_user, no grant', async () => {
    const res = await post(
      baseEvent({
        id: 'evt_anon',
        type: 'INITIAL_PURCHASE',
        app_user_id: '$RCAnonymousID:abc123',
        original_app_user_id: '$RCAnonymousID:abc123',
        product_id: 'nham_premium_monthly',
        original_transaction_id: 'otx_anon',
        purchased_at_ms: fixedNow.getTime(),
        expiration_at_ms: fixedNow.getTime() + 30 * 86_400_000,
      })
    );

    expect(res.status).toBe(200);
    expect(dbStub.grants).toHaveLength(0);
    expect(dbStub.events[0].processingError).toBe('unresolvable_user');
    expect(dbStub.events[0].userId).toBeNull();
  });

  it('anonymous app_user_id falls back to a uuid original_app_user_id', async () => {
    const res = await post(
      baseEvent({
        id: 'evt_anon_fallback',
        type: 'INITIAL_PURCHASE',
        app_user_id: '$RCAnonymousID:abc123',
        original_app_user_id: OTHER_USER_ID,
        product_id: 'nham_premium_monthly',
        original_transaction_id: 'otx_anon2',
        purchased_at_ms: fixedNow.getTime(),
        expiration_at_ms: fixedNow.getTime() + 30 * 86_400_000,
      })
    );

    expect(res.status).toBe(200);
    expect(dbStub.grants).toHaveLength(1);
    expect(dbStub.grants[0].userId).toBe(OTHER_USER_ID);
  });
});
