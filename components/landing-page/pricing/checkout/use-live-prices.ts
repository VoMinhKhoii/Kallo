'use client';

import { useWebPrices } from '@/hooks/billing/use-web-prices';
import type { WebPrices } from '@/lib/domain/billing/pricing/web-prices';
import { usePricingCheckout } from './checkout-context';

/**
 * The Premium card's live prices, from wherever `LivePrices` says to read
 * them: the Paddle preview (booted only for a known signed-out visitor), or
 * the signed-in visitor's offering. Undefined or null until there are any —
 * the card then shows its message-file fallback.
 */
export function useLivePrices(): WebPrices | null | undefined {
  const { live } = usePricingCheckout();
  const preview = useWebPrices(live.source === 'paddle');
  return live.source === 'offering' ? live.prices : preview.data;
}
