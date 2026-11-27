import { describe, expect, it, vi } from 'vitest';
import { appleAppSiteAssociation } from '@/lib/app-links/associations';

// `cacheLife()` only works inside a Next render; here it is a no-op.
vi.mock('next/cache', () => ({ cacheLife: () => undefined }));

describe('/.well-known/apple-app-site-association', () => {
  it('serves the Universal Links document as JSON, which iOS requires', async () => {
    const { GET } = await import(
      '@/app/.well-known/apple-app-site-association/route'
    );
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(await response.json()).toEqual(appleAppSiteAssociation);
  });
});
