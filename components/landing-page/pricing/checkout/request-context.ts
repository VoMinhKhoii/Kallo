'use client';

import { createContext, use } from 'react';

/** The request-time half of /pricing: who is looking, and where from. */
export interface PricingVisitor {
  userId: string | null;
  /** A validated, locale-prefixed in-app path, or null. */
  from: string | null;
}

/**
 * The visitor `PricingRequest` streamed in, or null while the prerendered
 * shell has not learned it yet.
 */
export const PricingRequestContext = createContext<{
  visitor: PricingVisitor | null;
  applyVisitor: (visitor: PricingVisitor) => void;
} | null>(null);

export function usePricingRequest() {
  const ctx = use(PricingRequestContext);
  if (!ctx) {
    throw new Error(
      'usePricingRequest must be used within PricingCheckoutProvider'
    );
  }
  return ctx;
}
