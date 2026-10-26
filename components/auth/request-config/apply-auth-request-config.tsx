'use client';

import { useEffect } from 'react';
import {
  type AuthRequestValues,
  useAuthDialog,
} from '@/components/auth/auth-provider';

/**
 * Hands the request-time values to the surrounding `AuthProvider` once they
 * stream in. Renders nothing. Folder-private: `AuthRequestConfig` is the entry.
 */
export function ApplyAuthRequestConfig({
  googleClientId,
  turnstileSiteKey,
  next,
  openTab,
}: AuthRequestValues) {
  const { applyRequestConfig } = useAuthDialog();

  useEffect(() => {
    applyRequestConfig({ googleClientId, turnstileSiteKey, next, openTab });
  }, [applyRequestConfig, googleClientId, turnstileSiteKey, next, openTab]);

  return null;
}
