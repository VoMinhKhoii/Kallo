import 'server-only';

import { z } from 'zod';
import {
  canonicalProductId,
  resolveProduct,
} from '@/lib/domain/billing/products';
import type { BillingEnvironment } from '@/lib/domain/billing/revenuecat/identity';

// Turn one RevenueCat CustomerInfo payload into the grant snapshot the rest of
// `lib/billing` projects. Nothing here does I/O: the wire schema, the
// environment/refund/lifetime fail-closed rules and the external-ref naming all
// live together so a provider shape change has exactly one landing site.

const nullableDate = z
  .string()
  .datetime({ offset: true })
  .nullable()
  .optional();

const entitlementSchema = z.object({
  expires_date: nullableDate,
  grace_period_expires_date: nullableDate,
  product_identifier: z.string().min(1),
  purchase_date: z.string().datetime({ offset: true }),
});

const subscriptionSchema = z
  .object({
    expires_date: nullableDate,
    grace_period_expires_date: nullableDate,
    purchase_date: z.string().datetime({ offset: true }),
    original_purchase_date: z.string().datetime({ offset: true }).optional(),
    store: z.string().min(1),
    is_sandbox: z.boolean(),
    unsubscribe_detected_at: nullableDate,
    refunded_at: nullableDate,
    // App Store transaction ids are represented as both strings and numbers in
    // RevenueCat's official v1 examples. We do not use this field for identity,
    // but accepting both shapes prevents a valid customer snapshot from failing
    // closed during reconciliation.
    store_transaction_id: z.union([z.string(), z.number()]).nullish(),
  })
  .passthrough();

const nonSubscriptionSchema = z
  .object({
    id: z.string().min(1),
    is_sandbox: z.boolean(),
    purchase_date: z.string().datetime({ offset: true }),
    store: z.string().min(1),
  })
  .passthrough();

const httpsUrlSchema = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === 'https:', {
    message: 'management_url must use HTTPS',
  });

const customerInfoSchema = z.object({
  request_date_ms: z.number().int().nonnegative(),
  subscriber: z.object({
    entitlements: z.record(z.string(), entitlementSchema),
    management_url: httpsUrlSchema.nullable(),
    non_subscriptions: z.record(z.string(), z.array(nonSubscriptionSchema)),
    original_app_user_id: z.string().min(1),
    subscriptions: z.record(z.string(), subscriptionSchema),
  }),
});

export interface RevenueCatGrantSnapshot {
  entitlementKey: 'premium' | 'billing_subscription';
  externalRef: string;
  productId: string;
  store: string | null;
  startsAt: Date;
  expiresAt: Date | null;
  willRenew: boolean;
  managementUrl: string | null;
}

export interface RevenueCatSnapshot {
  providerSyncedAt: Date;
  environment: BillingEnvironment;
  /**
   * RevenueCat's canonical customer id (`subscriber.original_app_user_id`) for
   * this lookup. Non-authoritative reconciliation trusts a snapshot only when
   * this matches the caller, so a snapshot that surfaces another user's receipt
   * can never first-claim a grant outside an authoritative provider event.
   */
  providerCustomerId: string;
  grants: RevenueCatGrantSnapshot[];
  /** RevenueCat created an empty customer while answering this lookup. */
  customerCreated?: boolean;
}

function laterDate(
  first: string | null | undefined,
  second: string | null | undefined
) {
  const dates = [first, second]
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value));
  if (dates.length === 0) return null;
  return dates.reduce((latest, value) =>
    value.getTime() > latest.getTime() ? value : latest
  );
}

function subscriptionForProduct(
  subscriptions: z.infer<
    typeof customerInfoSchema
  >['subscriber']['subscriptions'],
  productId: string,
  billingEnvironment: BillingEnvironment
) {
  const expectedSandbox = billingEnvironment === 'sandbox';
  const exact = subscriptions[productId];
  // An exact key from the wrong environment is authoritative evidence that
  // this entitlement is not backed by the environment being reconciled.
  if (exact) return exact.is_sandbox === expectedSandbox ? exact : undefined;

  // Google Play can expose an entitlement with the subscription id while the
  // transaction map is keyed as `<subscription>:<base-plan>`. Only accept an
  // exact catalog mapping for the same cadence. Prefix-only matching would
  // allow a malformed `monthly:annual` key to back monthly access.
  const requestedCanonical = canonicalProductId(productId);
  if (!requestedCanonical) return undefined;
  const matchingBasePlans = Object.entries(subscriptions)
    .filter(
      ([candidate, subscription]) =>
        canonicalProductId(candidate) === requestedCanonical &&
        subscription.is_sandbox === expectedSandbox
    )
    .map(([, subscription]) => subscription);
  return matchingBasePlans.length === 1 ? matchingBasePlans[0] : undefined;
}

function nonSubscriptionForProduct(
  purchases: z.infer<typeof nonSubscriptionSchema>[],
  billingEnvironment: BillingEnvironment,
  entitlementPurchaseDate: string
) {
  const expectedSandbox = billingEnvironment === 'sandbox';
  const entitlementPurchaseTime = new Date(entitlementPurchaseDate).getTime();
  const matchingPurchases = purchases.filter(
    (purchase) =>
      purchase.is_sandbox === expectedSandbox &&
      new Date(purchase.purchase_date).getTime() === entitlementPurchaseTime
  );
  return matchingPurchases.length === 1 ? matchingPurchases[0] : undefined;
}

function activeAt(expiresAt: Date | null, now: Date): boolean {
  return expiresAt === null || expiresAt.getTime() > now.getTime();
}

export function parseRevenueCatSnapshot(
  raw: unknown,
  _userId: string,
  billingEnvironment: BillingEnvironment,
  now = new Date()
): RevenueCatSnapshot {
  const info = customerInfoSchema.parse(raw);
  const { subscriber } = info;
  const providerSyncedAt = new Date(info.request_date_ms);
  const managementUrl = subscriber.management_url;
  const providerCustomerId = subscriber.original_app_user_id;
  const grants: RevenueCatGrantSnapshot[] = [];

  const premium = subscriber.entitlements.premium;
  const premiumProduct = premium
    ? resolveProduct(premium.product_identifier)
    : null;
  if (premium && !premiumProduct) {
    // RevenueCat says this customer is entitled, but the product is not in our
    // catalog, so no grant will be written and the customer keeps nothing they
    // paid for. Silence here reads exactly like "customer has no subscription".
    // The usual cause is a Paddle price id that exists in the dashboard but was
    // never added to `PADDLE_PRICE_PRODUCTS` — most likely the production
    // account, whose ids differ from sandbox. See docs/BILLING.md.
    console.error(
      `[billing] RevenueCat reports entitlement 'premium' backed by unmapped product ${premium.product_identifier}; no grant will be written`
    );
  }
  if (premium && premiumProduct?.entitlementKey === 'premium') {
    const expiresAt = laterDate(
      premium.expires_date,
      premium.grace_period_expires_date
    );
    if (
      activeAt(expiresAt, now) &&
      premiumProduct.lifetime === (expiresAt === null)
    ) {
      const subscription = subscriptionForProduct(
        subscriber.subscriptions,
        premium.product_identifier,
        billingEnvironment
      );
      const nonSubscription = nonSubscriptionForProduct(
        subscriber.non_subscriptions[premium.product_identifier] ?? [],
        billingEnvironment,
        premium.purchase_date
      );
      // Entitlement objects do not include `is_sandbox` in the v1 REST shape.
      // Require a backing transaction from the configured environment so a
      // sandbox purchase can never become a production grant. Also fail closed
      // on a refunded subscription even if an eventually-consistent entitlement
      // object still carries a future expiration.
      if ((subscription || nonSubscription) && !subscription?.refunded_at) {
        grants.push({
          entitlementKey: 'premium',
          externalRef: `customer:${providerCustomerId}:premium`,
          productId: premium.product_identifier,
          store:
            (subscription?.store ?? nonSubscription?.store)?.toLowerCase() ??
            null,
          startsAt: new Date(premium.purchase_date),
          expiresAt,
          willRenew:
            subscription != null &&
            subscription.unsubscribe_detected_at == null,
          managementUrl,
        });
      }
    }
  }

  // Keep renewable purchases visible even when a lifetime entitlement wins.
  // These rows never grant access; they only power management/cancellation UX.
  for (const [productId, subscription] of Object.entries(
    subscriber.subscriptions
  )) {
    const configuredProduct = resolveProduct(productId);
    const expiresAt = laterDate(
      subscription.expires_date,
      subscription.grace_period_expires_date
    );
    if (
      expiresAt === null ||
      !activeAt(expiresAt, now) ||
      subscription.refunded_at != null ||
      subscription.is_sandbox !== (billingEnvironment === 'sandbox') ||
      configuredProduct?.entitlementKey !== 'premium' ||
      configuredProduct.lifetime
    ) {
      continue;
    }
    grants.push({
      entitlementKey: 'billing_subscription',
      externalRef: `customer:${providerCustomerId}:subscription:${productId}`,
      productId,
      store: subscription.store.toLowerCase(),
      startsAt: new Date(
        subscription.original_purchase_date ?? subscription.purchase_date
      ),
      expiresAt,
      willRenew: subscription.unsubscribe_detected_at == null,
      managementUrl,
    });
  }

  return {
    providerSyncedAt,
    environment: billingEnvironment,
    providerCustomerId,
    grants,
  };
}
