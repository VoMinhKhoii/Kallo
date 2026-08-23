import { beforeEach, describe, expect, it, vi } from 'vitest';

const SUPABASE_URL = 'https://project-ref.supabase.co';

async function fetchMetadata() {
  vi.resetModules();
  const { GET } = await import(
    '@/app/.well-known/oauth-protected-resource/route'
  );
  const response = GET();
  return { response, body: await response.json() };
}

describe('/.well-known/oauth-protected-resource', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL);
  });

  it('serves JSON', async () => {
    const { response } = await fetchMetadata();
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');
  });

  it('names an https resource identifier with no fragment', async () => {
    // RFC 9728 §2: `resource` is the one required field, and the constraint on
    // it is exactly this.
    const { body } = await fetchMetadata();
    expect(body.resource).toBe('https://kallo.fit/api/v1');
    expect(body.resource.startsWith('https://')).toBe(true);
    expect(body.resource).not.toContain('#');
  });

  it('points at the Supabase Auth issuer', async () => {
    const { body } = await fetchMetadata();
    expect(body.authorization_servers).toEqual([`${SUPABASE_URL}/auth/v1`]);
  });

  it('does not invent a trailing slash when the env var has one', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', `${SUPABASE_URL}/`);
    const { body } = await fetchMetadata();
    expect(body.authorization_servers).toEqual([`${SUPABASE_URL}/auth/v1`]);
  });

  it('omits the authorization server rather than emitting a broken URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    const { body } = await fetchMetadata();
    expect(body).not.toHaveProperty('authorization_servers');
    expect(body.resource).toBeTruthy();
  });

  it('declares no scopes', async () => {
    // Supabase access tokens carry none. A scope list nothing enforces is worse
    // than no list at all, because a client would request against it.
    const { body } = await fetchMetadata();
    expect(body).not.toHaveProperty('scopes_supported');
  });

  it('says how a token is presented, and where the docs are', async () => {
    const { body } = await fetchMetadata();
    expect(body.bearer_methods_supported).toEqual(['header']);
    expect(body.resource_documentation).toBe(
      'https://kallo.fit/en/docs/developers/api'
    );
    expect(body.resource_policy_uri).toContain('/docs/legal/privacy');
    expect(body.resource_tos_uri).toContain('/docs/legal/terms');
  });
});
