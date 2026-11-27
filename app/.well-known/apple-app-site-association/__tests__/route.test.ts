import { describe, expect, it, vi } from 'vitest';

// `cacheLife()` only works inside a Next render; here it is a no-op.
vi.mock('next/cache', () => ({ cacheLife: () => undefined }));

async function fetchAssociation() {
  const { GET } = await import(
    '@/app/.well-known/apple-app-site-association/route'
  );
  const response = await GET();
  return { response, body: await response.json() };
}

describe('/.well-known/apple-app-site-association', () => {
  it('serves JSON, which iOS requires', async () => {
    const { response } = await fetchAssociation();
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');
  });

  it('claims invite links for the iOS app, in every locale and bare', async () => {
    const { body } = await fetchAssociation();
    expect(body.applinks.details).toEqual([
      {
        appIDs: ['ZNG57U88R5.com.khoivo.nham'],
        components: [
          { '/': '/en/invite/*' },
          { '/': '/vi/invite/*' },
          { '/': '/invite/*' },
        ],
      },
    ]);
  });
});
