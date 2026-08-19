'use client';

import { useQuery } from '@tanstack/react-query';
import {
  type EntitlementsResponse,
  entitlementsKeys,
  fetchEntitlements,
} from '@/lib/domain/billing/entitlements-client';

/**
 * The signed-in user's derived entitlement + trial state.
 *
 * `staleTime` is short (30s) because the tier can flip out-of-band when a
 * RevenueCat webhook lands after a purchase — the paywall's success
 * poll leans on refetches settling quickly.
 */
export function useEntitlements(userId: string | null) {
  return useQuery<EntitlementsResponse>({
    queryKey: userId ? entitlementsKeys.user(userId) : entitlementsKeys.all,
    queryFn: () => fetchEntitlements(userId as string),
    enabled: userId !== null,
    staleTime: 30 * 1000,
  });
}
