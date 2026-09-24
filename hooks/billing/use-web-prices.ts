'use client';

import { initializePaddle } from '@paddle/paddle-js';
import { useQuery } from '@tanstack/react-query';
import {
  paddleEnvironment,
  resolveWebPrices,
  WEB_PRICE_IDS,
} from '@/lib/domain/billing/pricing/paddle-preview';
import type { WebPrices } from '@/lib/domain/billing/pricing/web-prices';

const TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? '';

/**
 * The visitor's own Premium prices, from Paddle's price preview (country by
 * IP). `data` stays undefined while loading, without a client token, or when
 * Paddle is unreachable — the pricing card then shows its message-file
 * fallback, so the page never waits on a third party to say what it costs.
 */
export function useWebPrices(enabled = true) {
  const environment = paddleEnvironment(TOKEN);
  return useQuery<WebPrices | null>({
    queryKey: ['billing', 'web-prices', environment],
    enabled: enabled && environment !== null,
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
    queryFn: async () => {
      if (environment === null) return null;
      const paddle = await initializePaddle({ token: TOKEN, environment });
      if (!paddle) return null;
      const ids = WEB_PRICE_IDS[environment];
      const preview = await paddle.PricePreview({
        items: [
          { priceId: ids.monthly, quantity: 1 },
          { priceId: ids.annual, quantity: 1 },
        ],
      });
      return resolveWebPrices(preview, ids);
    },
  });
}
