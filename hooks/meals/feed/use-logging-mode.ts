'use client';

import { useState } from 'react';
import { usePremiumGuard } from '@/components/billing/premium-guard-provider';
import { type InputMode, MODE_FEATURE } from '@/lib/domain/logging/types';

/**
 * The composer's logging mode (Instant / Manual / Cheat meal).
 *
 * Until the user picks one, the mode is DERIVED: Instant for anyone who has AI
 * analysis, Manual for a free user under enforcement — Instant would only send
 * them to /pricing on their first submit. Derived rather than seeded so it
 * follows the entitlement query as it lands (`locked` is false while loading).
 * An explicit pick then wins for the rest of the session.
 */
export function useLoggingMode() {
  const { locked } = usePremiumGuard();
  const [picked, setPicked] = useState<InputMode | null>(null);
  const loggingMode: InputMode =
    picked ?? (locked(MODE_FEATURE.normal) ? 'manual' : 'normal');
  return [loggingMode, setPicked] as const;
}
