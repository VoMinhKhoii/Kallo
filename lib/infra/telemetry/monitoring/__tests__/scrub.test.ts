import { describe, expect, it } from 'vitest';
import { scrubBreadcrumb, scrubEvent, scrubTransaction } from '../scrub';

describe('scrubEvent', () => {
  it('strips request payload, cookies, headers and query string', () => {
    const event = scrubEvent({
      request: {
        url: 'https://kallo.fit/api/analyze-meal',
        data: { message: 'phở bò 2 bowls' },
        cookies: { 'sb-auth': 'x' },
        headers: { authorization: 'Bearer y' },
        query_string: 'token=z',
      },
    });
    expect(event.request).toEqual({
      url: 'https://kallo.fit/api/analyze-meal',
    });
  });

  it('reduces the request URL to its route pattern', () => {
    const event = scrubEvent({
      request: { url: 'https://kallo.fit/vi/invite/secret-slug?ref=x' },
    });
    expect(event.request?.url).toBe('https://kallo.fit/vi/invite/:param');
  });

  it('keeps only the opaque user id', () => {
    const event = scrubEvent({
      user: { id: 'uuid-1', email: 'a@b.c', ip_address: '1.2.3.4' },
    });
    expect(event.user).toEqual({ id: 'uuid-1' });
  });

  it('empties a user without an id', () => {
    expect(scrubEvent({ user: { email: 'a@b.c' } }).user).toEqual({});
  });
});

describe('scrubBreadcrumb', () => {
  it('drops console breadcrumbs, whose raw arguments can hold meal text', () => {
    expect(
      scrubBreadcrumb({
        category: 'console',
        data: { arguments: ['[analyze-meal] failed for', 'phở bò 2 bowls'] },
      })
    ).toBeNull();
  });

  it('keeps only allowlisted data keys', () => {
    expect(
      scrubBreadcrumb({
        category: 'fetch',
        data: {
          url: 'https://kallo.fit/api/v1/meals',
          method: 'POST',
          status_code: 500,
          body: 'phở bò',
        },
      })?.data
    ).toEqual({
      url: 'https://kallo.fit/api/v1/meals',
      method: 'POST',
      status_code: 500,
    });
  });

  it('patterns navigation paths and strips fetch query strings', () => {
    expect(
      scrubBreadcrumb({
        data: { from: '/en/circle/share-1', to: '/en/circle/g/group-2?tab=x' },
      })?.data
    ).toEqual({ from: '/en/circle/:param', to: '/en/circle/g/:param' });
    expect(
      scrubBreadcrumb({
        data: { url: 'https://kallo.fit/api/v1/meals?date=2026-09-01' },
      })?.data
    ).toEqual({ url: 'https://kallo.fit/api/v1/meals' });
  });
});

describe('scrubTransaction', () => {
  it('reduces URLs in span attributes and drops query strings', () => {
    const event = scrubTransaction({
      spans: [
        {
          op: 'http.client',
          description: 'GET https://kallo.fit/api/v1/groups/shares/share-1?t=x',
          data: {
            'url.full': 'https://kallo.fit/api/v1/groups/shares/share-1?t=x',
            'http.url': 'https://kallo.fit/vi/invite/secret',
            'http.target': '/vi/invite/secret?ref=y',
            'url.query': 't=x',
            'http.method': 'GET',
          },
        },
      ],
    });
    expect(event.spans?.[0]).toEqual({
      op: 'http.client',
      description: 'GET https://kallo.fit/api/v1/groups/shares/:param',
      data: {
        'url.full': 'https://kallo.fit/api/v1/groups/shares/:param',
        'http.url': 'https://kallo.fit/vi/invite/:param',
        'http.target': '/vi/invite/:param',
        'http.method': 'GET',
      },
    });
  });

  it('reduces a raw-path transaction name and the root span', () => {
    const event = scrubTransaction({
      transaction: '/en/circle/share-1',
      contexts: {
        trace: {
          op: 'pageload',
          data: { url: 'https://kallo.fit/en/circle/share-1?x=1' },
        },
      },
    });
    expect(event.transaction).toBe('/en/circle/:param');
    expect(event.contexts?.trace?.data).toEqual({
      url: 'https://kallo.fit/en/circle/:param',
    });
  });

  it('leaves a db span description (SQL) alone', () => {
    const sql = 'select * from meals where a / b > 1';
    const event = scrubTransaction({ spans: [{ op: 'db', description: sql }] });
    expect(event.spans?.[0].description).toBe(sql);
  });

  it('still scrubs the request like an error event', () => {
    const event = scrubTransaction({
      request: { url: 'https://kallo.fit/api/analyze-meal', data: 'phở' },
    });
    expect(event.request).toEqual({
      url: 'https://kallo.fit/api/analyze-meal',
    });
  });
});
