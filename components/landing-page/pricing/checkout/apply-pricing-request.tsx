'use client';

import { useEffect } from 'react';
import { type PricingVisitor, usePricingRequest } from './request-context';

/**
 * Hands the streamed request values to the surrounding
 * `PricingCheckoutProvider`. Renders nothing. Folder-private:
 * `PricingRequest` is the entry.
 */
export function ApplyPricingRequest({ userId, from }: PricingVisitor) {
  const { applyVisitor } = usePricingRequest();

  useEffect(() => {
    applyVisitor({ userId, from });
  }, [applyVisitor, userId, from]);

  return null;
}
