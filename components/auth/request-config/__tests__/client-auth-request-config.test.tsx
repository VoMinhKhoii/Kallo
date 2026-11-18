import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuthDialog } from '@/components/auth/auth-provider';
import { ClientAuthRequestConfig } from '../client-auth-request-config';

function Probe() {
  const { open, next, googleClientId, turnstileSiteKey, requestConfigPending } =
    useAuthDialog();
  return (
    <output>
      {JSON.stringify({
        open,
        next,
        googleClientId,
        turnstileSiteKey,
        requestConfigPending,
      })}
    </output>
  );
}

function state() {
  return JSON.parse(screen.getByRole('status').textContent ?? '{}');
}

function renderWithConfig(response: Response | Promise<Response>) {
  const fetchMock = vi.fn(async () => response);
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <ClientAuthRequestConfig />
        <Probe />
      </AuthProvider>
    </QueryClientProvider>
  );
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// A fully static page reads the values after load instead of in the render.
describe('ClientAuthRequestConfig', () => {
  it('hands the fetched Google client ID and Turnstile site key to the provider', async () => {
    const fetchMock = renderWithConfig(
      Response.json({
        googleClientId: 'web-client-id',
        turnstileSiteKey: 'site-key',
      })
    );

    await waitFor(() =>
      expect(state()).toMatchObject({
        googleClientId: 'web-client-id',
        turnstileSiteKey: 'site-key',
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/client-config',
      expect.anything()
    );
    // Config only: it never opens the dialog or sets a return path.
    expect(state()).toMatchObject({ open: false, next: null });
  });

  it('marks the config pending until the values arrive, so the email step waits', async () => {
    let answer!: (r: Response) => void;
    renderWithConfig(
      new Promise<Response>((resolve) => {
        answer = resolve;
      })
    );

    await waitFor(() =>
      expect(state()).toMatchObject({ requestConfigPending: true })
    );
    answer(Response.json({ googleClientId: 'id', turnstileSiteKey: 'key' }));
    await waitFor(() =>
      expect(state()).toMatchObject({
        requestConfigPending: false,
        turnstileSiteKey: 'key',
      })
    );
  });

  it('leaves the provider as it was when the config cannot be loaded', async () => {
    const fetchMock = renderWithConfig(new Response('down', { status: 503 }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // Stops holding the form once the load has failed.
    await waitFor(() =>
      expect(state()).toMatchObject({ requestConfigPending: false })
    );
    expect(state()).toMatchObject({
      googleClientId: null,
      turnstileSiteKey: null,
      open: false,
    });
  });
});
