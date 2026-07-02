import { describe, expect, it, vi } from 'vitest';

const createBrowserClient = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createBrowserClient,
}));

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_key');

const { createClient } = await import('@/lib/supabase/client');

describe('createClient', () => {
  it('points the browser client at the same-origin auth proxy', () => {
    createClient();

    expect(createBrowserClient).toHaveBeenCalledWith(
      `${window.location.origin}/api/supabase-proxy`,
      'sb_publishable_key'
    );
  });
});
