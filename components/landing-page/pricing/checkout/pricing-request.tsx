import { safeNextPath } from '@/lib/infra/auth/safe-next';
import { createClient } from '@/lib/infra/supabase/server';
import { ApplyPricingRequest } from './apply-pricing-request';

export interface PricingSearchParams {
  from?: string | string[];
}

/**
 * The request-time inputs of /pricing: the signed-in user, if any, and the
 * `?from=` path the back link returns to (validated as an in-app,
 * locale-prefixed path, so it can never become an open redirect).
 *
 * Render it inside `<Suspense fallback={null}>` under
 * `PricingCheckoutProvider`: the cards paint from the prerendered shell,
 * signed out, and turn into the purchase surface once this streams in.
 */
export async function PricingRequest({
  searchParams,
}: {
  searchParams: Promise<PricingSearchParams>;
}) {
  const [{ from }, supabase] = await Promise.all([
    searchParams,
    createClient(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <ApplyPricingRequest
      userId={user?.id ?? null}
      from={safeNextPath(typeof from === 'string' ? from : null)}
    />
  );
}
