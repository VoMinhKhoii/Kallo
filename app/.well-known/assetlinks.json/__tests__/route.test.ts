import { describe, expect, it, vi } from 'vitest';
import { androidAssetLinks } from '@/lib/app-links/associations';

// `cacheLife()` only works inside a Next render; here it is a no-op.
vi.mock('next/cache', () => ({ cacheLife: () => undefined }));

describe('/.well-known/assetlinks.json', () => {
  it('serves the App Links statement as JSON', async () => {
    const { GET } = await import('@/app/.well-known/assetlinks.json/route');
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(await response.json()).toEqual(androidAssetLinks);
  });
});
