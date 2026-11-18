'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { preload } from 'react-dom';
import { useAuthDialog } from '@/components/auth/auth-provider';

interface ClientAuthConfig {
  googleClientId: string | null;
  turnstileSiteKey: string | null;
}

export const clientAuthConfigKey = ['auth', 'client-config'] as const;

const CLIENT_AUTH_CONFIG_URL = '/api/v1/auth/client-config';

export async function fetchClientAuthConfig(): Promise<ClientAuthConfig> {
  // No custom headers, so the browser can reuse the response the page
  // preloaded; bounded, so a hung origin cannot hold the email form for long.
  const res = await fetch(CLIENT_AUTH_CONFIG_URL, {
    signal: AbortSignal.timeout(5000),
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
  // Start the request while the browser is still parsing the HTML, so the
  // values land about when the server-streamed version used to.
  preload(CLIENT_AUTH_CONFIG_URL, { as: 'fetch', crossOrigin: 'anonymous' });
  const { applyRequestConfig, setRequestConfigPending } = useAuthDialog();
  const { data, isError } = useQuery({
    queryKey: clientAuthConfigKey,
    queryFn: fetchClientAuthConfig,
    // Changes only with a deploy.
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
    if (data) {
      applyRequestConfig(data);
      return;
    }
    // Pending until the values arrive. If they cannot be loaded at all, stop
    // holding the form: the provider then behaves as it did with nothing set.
    setRequestConfigPending(!isError);
  }, [applyRequestConfig, setRequestConfigPending, data, isError]);

  return null;
}
