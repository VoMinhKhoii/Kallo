'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuthDialog } from '@/components/auth/auth-provider';

interface ClientAuthConfig {
  googleClientId: string | null;
  turnstileSiteKey: string | null;
}

export const clientAuthConfigKey = ['auth', 'client-config'] as const;

export async function fetchClientAuthConfig(): Promise<ClientAuthConfig> {
  const res = await fetch('/api/v1/auth/client-config', {
    headers: { accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Auth config unavailable (${res.status})`);
  return (await res.json()) as ClientAuthConfig;
}

/**
 * The sign-in dialog's runtime values for a page that is fully static: fetched
 * once after load from `/api/v1/auth/client-config` and handed to the
 * surrounding `AuthProvider`, as `AuthRequestConfig` does from the server.
 *
 * `AuthRequestConfig` reads them during the render, which needs `connection()`
 * and so renders the whole page per request. Pages with no other per-request
 * part (calories, tools, comparisons, data) use this instead and are served
 * from the prerender: 19-33 ms on the server rather than 69-169 ms. Until the
 * values arrive the provider holds what it was created with, exactly as it
 * does while the server version streams in.
 */
export function ClientAuthRequestConfig() {
  const { applyRequestConfig } = useAuthDialog();
  const { data } = useQuery({
    queryKey: clientAuthConfigKey,
    queryFn: fetchClientAuthConfig,
    // Changes only with a deploy.
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
    if (data) applyRequestConfig(data);
  }, [applyRequestConfig, data]);

  return null;
}
