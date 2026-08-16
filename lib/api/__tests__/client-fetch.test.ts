import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { postJson, request } from '@/lib/api/client-fetch';
import { ApiError } from '@/lib/errors/client';

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: () => Promise.resolve(body) } as Response;
}

/** A non-ok response whose body is not JSON — `response.json()` rejects. */
function unparseableResponse() {
  return {
    ok: false,
    json: () => Promise.reject(new SyntaxError('Unexpected token <')),
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('request', () => {
  it('resolves the parsed JSON body of an ok response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ profile: { handle: 'khoi' } }));

    await expect(request('/api/v1/groups/profile')).resolves.toEqual({
      profile: { handle: 'khoi' },
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/groups/profile', undefined);
  });

  it('forwards the caller init untouched', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ removed: true }));
    const init = { method: 'DELETE' as const };

    await request('/api/v1/groups/friends/remove', init);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/groups/friends/remove',
      init
    );
  });

  it('throws the parsed error envelope when the response is not ok', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'RATE_LIMITED',
            status: 429,
            retryable: true,
            message: 'Chậm lại nhé.',
          },
        },
        false
      )
    );

    const error = await request('/api/v1/groups/feed').catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
      retryable: true,
    });
  });

  it('throws the null-body error when the failure body is not JSON', async () => {
    fetchMock.mockResolvedValue(unparseableResponse());

    const error = await request('/api/v1/groups/feed').catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: 'UNKNOWN',
      status: 500,
      retryable: false,
    });
  });
});

describe('postJson', () => {
  it('posts a JSON-encoded body and resolves the parsed response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ added: 2 }));

    await expect(
      postJson('/api/v1/chat-groups/g1/members', { memberUserIds: ['a', 'b'] })
    ).resolves.toEqual({ added: 2 });

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/chat-groups/g1/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberUserIds: ['a', 'b'] }),
    });
  });

  it('surfaces a non-ok response as the parsed error', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: { code: 'FORBIDDEN', status: 403, retryable: false } },
        false
      )
    );

    const error = await postJson('/api/v1/groups/invite/accept', {
      slug: 'x',
    }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'FORBIDDEN', status: 403 });
  });
});
