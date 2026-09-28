import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const findCachedRow = vi.fn();
const assertRateLimit = vi.fn();

vi.mock('@/lib/domain/barcode/cache', () => ({ findCachedRow }));
vi.mock('@/lib/infra/rate-limit/limiter/limiter', () => ({ assertRateLimit }));

const { GET } = await import('@/app/api/v1/barcode/image/[code]/route');

const PHOTO =
  'https://images.openfoodfacts.org/images/products/893/850/784/9131/front_en.44.400.jpg';

function call(code: string) {
  const request = new Request(`http://localhost/api/v1/barcode/image/${code}`, {
    headers: { 'x-forwarded-for': '203.0.113.7' },
  }) as unknown as NextRequest;
  return GET(request, { params: Promise.resolve({ code }) });
}

function mockUpstream(body: string, contentType: string, ok = true) {
  return vi.spyOn(global, 'fetch').mockResolvedValue(
    new Response(body, {
      status: ok ? 200 : 500,
      headers: { 'content-type': contentType },
    })
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  findCachedRow.mockReset();
  assertRateLimit.mockReset();
  assertRateLimit.mockResolvedValue(undefined);
});

describe('GET /api/v1/barcode/image/[code]', () => {
  it('streams the stored photo with a long public cache', async () => {
    findCachedRow.mockResolvedValue({
      id: 'off_8938507849131',
      imageUrl: PHOTO,
    });
    const fetchSpy = mockUpstream('jpeg-bytes', 'image/jpeg');

    const res = await call('8938507849131');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('cache-control')).toBe('public, max-age=604800');
    expect(await res.text()).toBe('jpeg-bytes');
    expect(fetchSpy).toHaveBeenCalledWith(PHOTO, expect.any(Object));
  });

  it('rate-limits by IP before any lookup', async () => {
    const { Errors } = await import('@/lib/core/errors/catalog');
    assertRateLimit.mockRejectedValueOnce(Errors.rateLimited(undefined, 5));

    const res = await call('8938507849131');

    expect(res.status).toBe(429);
    expect(assertRateLimit).toHaveBeenCalledWith('barcodeImageIp', {
      kind: 'ip',
      value: expect.any(String),
    });
    expect(findCachedRow).not.toHaveBeenCalled();
  });

  it('404s a barcode nobody has scanned, without fetching anything', async () => {
    findCachedRow.mockResolvedValue(undefined);
    const fetchSpy = vi.spyOn(global, 'fetch');

    const res = await call('8938507849131');

    expect(res.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('404s a malformed code without touching the store', async () => {
    const res = await call('abc');

    expect(res.status).toBe(404);
    expect(findCachedRow).not.toHaveBeenCalled();
  });

  it('refuses to fetch a stored URL off the trusted image host', async () => {
    findCachedRow.mockResolvedValue({
      id: 'off_8938507849131',
      imageUrl: 'http://169.254.169.254/latest/meta-data',
    });
    const fetchSpy = vi.spyOn(global, 'fetch');

    const res = await call('8938507849131');

    expect(res.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuses a redirect instead of following it off the trusted host', async () => {
    findCachedRow.mockResolvedValue({
      id: 'off_8938507849131',
      imageUrl: PHOTO,
    });
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'http://169.254.169.254/latest/meta-data' },
      })
    );

    const res = await call('8938507849131');

    expect(res.status).toBe(404);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
  });

  it('refuses an announced oversize body before buffering it', async () => {
    findCachedRow.mockResolvedValue({
      id: 'off_8938507849131',
      imageUrl: PHOTO,
    });
    const body = new Response('x', {
      headers: { 'content-type': 'image/jpeg', 'content-length': '50000000' },
    });
    const arrayBuffer = vi.spyOn(body, 'arrayBuffer');
    vi.spyOn(global, 'fetch').mockResolvedValue(body);

    const res = await call('8938507849131');

    expect(res.status).toBe(404);
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it('never serves an SVG from our origin', async () => {
    findCachedRow.mockResolvedValue({
      id: 'off_8938507849131',
      imageUrl: PHOTO,
    });
    mockUpstream('<svg onload="alert(1)"/>', 'image/svg+xml');

    const res = await call('8938507849131');

    expect(res.status).toBe(404);
  });

  it('404s when the upstream answer is not an image', async () => {
    findCachedRow.mockResolvedValue({
      id: 'off_8938507849131',
      imageUrl: PHOTO,
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUpstream('<html>', 'text/html');

    const res = await call('8938507849131');

    expect(res.status).toBe(404);
  });
});
