import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createImmutable, download, upload } from '../gcs';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv('GCS_ACCESS_TOKEN', 'test-token');
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const respond = (status: number, body = '', headers = {}) =>
  new Response(status === 204 ? null : body, { status, headers });

describe('upload', () => {
  it('sends the generation precondition and reports a lost race as false', async () => {
    fetchMock.mockResolvedValueOnce(respond(412));

    const ok = await upload('b', 'f1/by-key/k.json', new Uint8Array([1]), '0');

    expect(ok).toBe(false);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('ifGenerationMatch=0');
    expect(url).toContain('name=f1%2Fby-key%2Fk.json');
    expect(init.headers.Authorization).toBe('Bearer test-token');
  });

  it('retries a server error, then succeeds', async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(respond(503))
      .mockResolvedValueOnce(respond(200, '{}'));

    const pending = upload('b', 'x', new Uint8Array([1]), '0');
    await vi.runAllTimersAsync();

    expect(await pending).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('throws on a non-retryable error', async () => {
    fetchMock.mockResolvedValueOnce(respond(403));
    await expect(upload('b', 'x', new Uint8Array([1]), '0')).rejects.toThrow(
      /403/
    );
  });
});

describe('createImmutable', () => {
  const body = new Uint8Array([1, 2, 3]);
  const md5 = createHash('md5').update(body).digest('base64');

  it('accepts an existing object with identical bytes (a retried upload)', async () => {
    fetchMock
      .mockResolvedValueOnce(respond(412))
      .mockResolvedValueOnce(
        respond(200, JSON.stringify({ generation: '7', md5Hash: md5 }))
      );
    await expect(createImmutable('b', 'f1/x/texts.f16', body)).resolves.toBe(
      undefined
    );
  });

  it('refuses to accept an existing object with other bytes', async () => {
    fetchMock
      .mockResolvedValueOnce(respond(412))
      .mockResolvedValueOnce(
        respond(200, JSON.stringify({ generation: '7', md5Hash: 'other' }))
      );
    await expect(createImmutable('b', 'f1/x/texts.f16', body)).rejects.toThrow(
      /other contents/
    );
  });
});

describe('download', () => {
  it('returns the body and its generation, or null when absent', async () => {
    fetchMock
      .mockResolvedValueOnce(
        respond(200, '{"buildId":"b1"}', { 'x-goog-generation': '42' })
      )
      .mockResolvedValueOnce(respond(404));

    const found = await download('b', 'f1/by-key/k.json');
    expect(found?.generation).toBe('42');
    expect(found?.body.toString()).toBe('{"buildId":"b1"}');
    expect(await download('b', 'missing')).toBeNull();
  });
});
