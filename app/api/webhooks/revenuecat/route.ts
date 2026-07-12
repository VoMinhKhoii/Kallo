import { timingSafeEqual } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveProduct } from '@/lib/billing/products';
import { type AppDb, db as appDb } from '@/lib/db';
import { billingWebhookEvents } from '@/lib/db/schema';
import {
  markGrantStatus,
  setGrantWillRenew,
  upsertGrant,
} from '@/lib/entitlements/grants';

// RevenueCat webhook handler. RC is the single writer of purchase state
// (Apple IAP, Play Billing, and Paddle web checkout all flow through it).
//
// Payload shape confirmed against the current RC docs:
// https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
//   - refunds arrive as CANCELLATION with cancel_reason = 'CUSTOMER_SUPPORT'
//     (there is NO literal REFUND event type);
//   - a normal auto-renew-off cancellation is CANCELLATION with cancel_reason
//     UNSUBSCRIBE/BILLING_ERROR/etc. — access continues to expiration_at_ms;
//   - EXPIRATION is the true end-of-access event;
//   - TRANSFER carries transferred_from / transferred_to App User ID arrays.

export const runtime = 'nodejs';

const SOURCE = 'revenuecat';
const ENTITLEMENT_KEY = 'premium';

// UUID (Supabase auth uid) matcher — RC anonymous ids look like
// '$RCAnonymousID:...' and must never be treated as a user id.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only the fields we act on are validated; unknown fields pass through
// (RC adds fields over time and we still record the full raw payload).
const eventSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    app_user_id: z.string().min(1),
    original_app_user_id: z.string().nullish(),
    product_id: z.string().nullish(),
    expiration_at_ms: z.number().nullish(),
    purchased_at_ms: z.number().nullish(),
    environment: z.string().nullish(),
    store: z.string().nullish(),
    cancel_reason: z.string().nullish(),
    transaction_id: z.string().nullish(),
    original_transaction_id: z.string().nullish(),
    transferred_from: z.array(z.string()).nullish(),
    transferred_to: z.array(z.string()).nullish(),
  })
  .passthrough();

const bodySchema = z
  .object({
    event: eventSchema,
  })
  .passthrough();

type RcEvent = z.infer<typeof eventSchema>;

export interface WebhookDeps {
  db?: AppDb;
  now?: () => Date;
  // Overridable so tests can drive the sandbox-vs-production branch without
  // mutating NODE_ENV.
  isProduction?: boolean;
}

function timingSafeMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // timingSafeEqual throws on length mismatch — guard it, but still compare
  // so we don't early-return on a length side channel.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// externalRef fallback chain: RC's stable subscription identifier is the
// original_transaction_id; fall back to the transaction_id; and finally to a
// synthesized "<user>:<product>" key so we never write a null upsert key.
function resolveExternalRef(event: RcEvent): string {
  if (event.original_transaction_id) return event.original_transaction_id;
  if (event.transaction_id) return event.transaction_id;
  return `${event.app_user_id}:${event.product_id ?? 'unknown'}`;
}

// app_user_id is the Supabase uid (clients call Purchases.logIn(uid)). If it
// is anonymous, fall back to original_app_user_id when that is a real uuid.
function resolveUserId(event: RcEvent): string | null {
  if (UUID_RE.test(event.app_user_id)) return event.app_user_id;
  if (event.original_app_user_id && UUID_RE.test(event.original_app_user_id)) {
    return event.original_app_user_id;
  }
  return null;
}

function truncateError(message: string): string {
  return message.length > 500 ? message.slice(0, 500) : message;
}

interface HandledOutcome {
  processingError: string | null;
}

// Applies the event to grants and returns any soft processing_error. Throws
// on an unexpected failure so the caller records the error + returns 500.
async function applyEvent(
  event: RcEvent,
  userId: string,
  deps: Required<Pick<WebhookDeps, 'db' | 'now'>>
): Promise<HandledOutcome> {
  const externalRef = resolveExternalRef(event);

  const purchaseGrant = async (): Promise<HandledOutcome> => {
    const product = event.product_id ? resolveProduct(event.product_id) : null;
    if (!product) return { processingError: 'unknown_product' };

    const startsAt =
      event.purchased_at_ms != null
        ? new Date(event.purchased_at_ms)
        : deps.now();

    // Lifetime → never expires + cannot renew. Non-lifetime needs an
    // expiration; a missing one on a renewing product is a payload error.
    let expiresAt: Date | null;
    if (product.lifetime) {
      expiresAt = null;
    } else if (event.expiration_at_ms != null) {
      expiresAt = new Date(event.expiration_at_ms);
    } else {
      return { processingError: 'missing_expiration' };
    }

    await upsertGrant(
      {
        userId,
        entitlementKey: ENTITLEMENT_KEY,
        source: SOURCE,
        store: event.store?.toLowerCase() ?? null,
        productId: event.product_id ?? null,
        startsAt,
        expiresAt,
        status: 'active',
        willRenew: !product.lifetime,
        externalRef,
      },
      deps
    );
    return { processingError: null };
  };

  switch (event.type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
    case 'PRODUCT_CHANGE':
      return purchaseGrant();

    case 'NON_RENEWING_PURCHASE': {
      const product = event.product_id
        ? resolveProduct(event.product_id)
        : null;
      if (!product) return { processingError: 'unknown_product' };

      let expiresAt: Date | null;
      if (product.lifetime) {
        expiresAt = null;
      } else if (event.expiration_at_ms != null) {
        expiresAt = new Date(event.expiration_at_ms);
      } else {
        return { processingError: 'missing_expiration' };
      }

      await upsertGrant(
        {
          userId,
          entitlementKey: ENTITLEMENT_KEY,
          source: SOURCE,
          store: event.store?.toLowerCase() ?? null,
          productId: event.product_id ?? null,
          startsAt:
            event.purchased_at_ms != null
              ? new Date(event.purchased_at_ms)
              : deps.now(),
          expiresAt,
          // Non-renewing purchases never auto-renew.
          status: 'active',
          willRenew: false,
          externalRef,
        },
        deps
      );
      return { processingError: null };
    }

    case 'CANCELLATION': {
      // RC delivers refunds as CANCELLATION with cancel_reason
      // CUSTOMER_SUPPORT. Those we treat as revoked (status 'refunded'). Every
      // other cancel_reason (UNSUBSCRIBE, BILLING_ERROR, ...) only turns
      // auto-renew off — access runs to period end, so status stays 'active'
      // and we flip willRenew=false (NOT status 'canceled', which the enum
      // reserves for revoked-before-expiry).
      if (event.cancel_reason === 'CUSTOMER_SUPPORT') {
        await markGrantStatus(
          { source: SOURCE, externalRef, status: 'refunded' },
          deps
        );
      } else {
        await setGrantWillRenew(
          { source: SOURCE, externalRef, willRenew: false },
          deps
        );
      }
      return { processingError: null };
    }

    case 'EXPIRATION':
      await markGrantStatus(
        { source: SOURCE, externalRef, status: 'expired' },
        deps
      );
      return { processingError: null };

    // Forward-compat: RC has no literal REFUND type today (refunds are the
    // CANCELLATION/CUSTOMER_SUPPORT path above), but if one appears, revoke.
    case 'REFUND':
      await markGrantStatus(
        { source: SOURCE, externalRef, status: 'refunded' },
        deps
      );
      return { processingError: null };

    case 'TRANSFER':
      // The event is sent for the destination user (transferred_to). Moving
      // grants requires knowing which subscription identifiers (externalRefs)
      // to reassign, but the RC transfer payload carries no transaction ids —
      // only the from/to App User ID arrays. We therefore cannot cleanly
      // determine the affected grants and record 'transfer_unhandled' rather
      // than guess. (reassignGrants exists for admin tooling that DOES know
      // the refs.)
      return { processingError: 'transfer_unhandled' };

    case 'TEST':
      return { processingError: null };

    default:
      return { processingError: 'unhandled_type' };
  }
}

export async function POST(request: Request, deps?: WebhookDeps) {
  const database = deps?.db ?? appDb;
  const now = deps?.now ?? (() => new Date());
  const isProduction =
    deps?.isProduction ?? process.env.NODE_ENV === 'production';

  // --- Auth: RC echoes the configured Authorization header verbatim. ---
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret) {
    // Never silently accept unauthenticated writes to billing state.
    console.error(
      'REVENUECAT_WEBHOOK_SECRET is not configured — rejecting webhook.'
    );
    return NextResponse.json(
      { error: 'webhook_not_configured' },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader || !timingSafeMatch(authHeader, secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // --- Parse + validate body. Malformed JSON is a client error (400). ---
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_payload', detail: parsed.error.issues[0]?.message },
      { status: 400 }
    );
  }

  const body = parsed.data;
  const event = body.event;
  const userId = resolveUserId(event);

  // --- Idempotency barrier: record FIRST. A redelivery (same event id)
  // inserts nothing (onConflictDoNothing). ---
  const inserted = await database
    .insert(billingWebhookEvents)
    .values({
      source: SOURCE,
      externalEventId: event.id,
      eventType: event.type,
      userId,
      rawPayload: body,
      createdAt: now(),
    })
    .onConflictDoNothing({
      target: [
        billingWebhookEvents.source,
        billingWebhookEvents.externalEventId,
      ],
    })
    .returning({ id: billingWebhookEvents.id });

  let eventRowId: string;
  if (inserted.length === 0) {
    // A row already exists for this (source, event id). If it was already
    // processed (processedAt set), this is a true duplicate — short-circuit.
    // If processedAt is NULL, the previous attempt failed or crashed after
    // recording only a processing_error, so re-run it against the same row
    // rather than poisoning it as a permanent duplicate.
    const existing = await database
      .select({
        id: billingWebhookEvents.id,
        processedAt: billingWebhookEvents.processedAt,
      })
      .from(billingWebhookEvents)
      .where(
        and(
          eq(billingWebhookEvents.source, SOURCE),
          eq(billingWebhookEvents.externalEventId, event.id)
        )
      )
      .limit(1);

    const existingRow = existing[0];
    if (!existingRow || existingRow.processedAt !== null) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    eventRowId = existingRow.id;
  } else {
    eventRowId = inserted[0].id;
  }

  // Success stamp: sets processedAt + clears/records a soft processing_error.
  const finish = async (processingError: string | null) => {
    await database
      .update(billingWebhookEvents)
      .set({
        processedAt: now(),
        processingError: processingError
          ? truncateError(processingError)
          : null,
      })
      .where(eq(billingWebhookEvents.id, eventRowId));
  };

  // Failure stamp: records the error but leaves processedAt NULL so a RC
  // redelivery re-runs the event instead of short-circuiting as a duplicate.
  const recordError = async (processingError: string) => {
    await database
      .update(billingWebhookEvents)
      .set({ processingError: truncateError(processingError) })
      .where(eq(billingWebhookEvents.id, eventRowId));
  };

  // Unresolvable user: record + processing_error, 200 (RC must not retry an
  // event we can never attribute to a user).
  if (!userId) {
    await finish('unresolvable_user');
    return NextResponse.json({ received: true });
  }

  // Sandbox guard: sandbox events are always recorded, but in PRODUCTION they
  // must NOT mutate grants. In non-production (dev/preview/test) sandbox
  // events DO apply so the flow is testable end-to-end.
  if (event.environment === 'SANDBOX' && isProduction) {
    await finish('sandbox_ignored');
    return NextResponse.json({ received: true });
  }

  try {
    const outcome = await applyEvent(event, userId, { db: database, now });
    await finish(outcome.processingError);
    return NextResponse.json({ received: true });
  } catch (error) {
    // Persist the failure WITHOUT stamping processedAt and return 500 so RC
    // retries with the same event id; the retry finds processedAt NULL and
    // re-runs applyEvent (see the duplicate-insert branch above).
    const message =
      error instanceof Error ? error.message : 'unknown_processing_error';
    try {
      await recordError(message);
    } catch {
      // If even the error write fails, still surface a 500 to trigger retry.
    }
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 });
  }
}
