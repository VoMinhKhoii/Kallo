// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCrawlerCopy, isCrawlerPageRequest } from '../crawler-cache';

const GPTBOT =
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot';
const SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

function crawlerRequest(
  url: string,
  headers: Record<string, string> = {},
  method = 'GET'
): Request {
  return new Request(url, {
    method,
    headers: { 'User-Agent': GPTBOT, ...headers },
  });
}

describe('isCrawlerPageRequest', () => {
  it.each([
    'https://kallo.fit/vi/calories/mi-goi',
    'https://kallo.fit/en/calories',
    'https://kallo.fit/en/tools/tdee-calculator',
    'https://kallo.fit/en/compare/kallo-vs-cal-ai',
    'https://kallo.fit/en/alternatives/cal-ai',
    'https://kallo.fit/vi/docs/overview',
    'https://kallo.fit/en/data/meal-calorie-variation',
  ])('takes a crawler asking for %s', (url) => {
    expect(isCrawlerPageRequest(crawlerRequest(url))).toBe(true);
  });

  it.each([
    ['no Accept header', undefined],
    ['a browser-style Accept', 'text/html,application/xhtml+xml,*/*;q=0.8'],
    ['any type', '*/*'],
  ])('takes %s, which the origin answers with HTML', (_name, accept) => {
    const headers: Record<string, string> = accept ? { Accept: accept } : {};
    expect(
      isCrawlerPageRequest(
        crawlerRequest('https://kallo.fit/en/docs/overview', headers)
      )
    ).toBe(true);
  });

  it.each([
    [
      'a browser',
      'https://kallo.fit/en/calories/pho',
      { 'User-Agent': SAFARI },
    ],
    ['the landing page', 'https://kallo.fit/en', {}],
    ['pricing', 'https://kallo.fit/en/pricing', {}],
    ['an API call', 'https://kallo.fit/api/v1/foods', {}],
    [
      'a signed-in request',
      'https://kallo.fit/en/calories/pho',
      { Cookie: 'sb-access-token=x' },
    ],
    [
      'a request with a bearer',
      'https://kallo.fit/en/calories/pho',
      { Authorization: 'Bearer x' },
    ],
    [
      'a client-side navigation',
      'https://kallo.fit/en/docs/overview',
      { RSC: '1' },
    ],
    [
      'a prefetch',
      'https://kallo.fit/en/docs/overview',
      { 'Next-Router-Prefetch': '1' },
    ],
    ['a query string', 'https://kallo.fit/en/calories/pho?utm_source=x', {}],
    [
      'a trailing slash, which redirects',
      'https://kallo.fit/en/calories/pho/',
      {},
    ],
    ['another host', 'https://www.kallo.fit/en/calories/pho', {}],
    [
      'an agent asking for Markdown',
      'https://kallo.fit/en/docs/overview',
      { Accept: 'text/markdown, text/html;q=0.5' },
    ],
    [
      'a client that takes neither HTML nor Markdown',
      'https://kallo.fit/en/docs/overview',
      { Accept: 'application/json' },
    ],
    [
      'a browser whose user agent says "bot"',
      'https://kallo.fit/en/calories/pho',
      {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 13; CUBOT P80) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Sec-CH-UA': '"Chromium";v="120"',
        'Sec-Fetch-Mode': 'navigate',
      },
    ],
  ])('leaves %s to the origin', (_name, url, headers) => {
    expect(isCrawlerPageRequest(crawlerRequest(url, headers))).toBe(false);
  });

  it('only takes reads', () => {
    expect(
      isCrawlerPageRequest(
        crawlerRequest('https://kallo.fit/en/calories/pho', {}, 'POST')
      )
    ).toBe(false);
    expect(
      isCrawlerPageRequest(
        crawlerRequest('https://kallo.fit/en/calories/pho', {}, 'HEAD')
      )
    ).toBe(true);
  });
});

describe('fetchCrawlerCopy', () => {
  const ORIGIN = 'https://kallo-prod-test.asia-southeast1.run.app';
  const upstream = vi.fn(
    async (
      _req: Request,
      _init?: RequestInit & { cf?: Record<string, unknown> }
    ) => new Response('page', { status: 200 })
  );

  beforeEach(() => {
    upstream.mockClear();
    vi.stubGlobal('fetch', upstream);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the forwarded headers and adds the cache address', async () => {
    await fetchCrawlerCopy(
      new Request(`${ORIGIN}/en/calories/pho`, {
        headers: { 'X-Origin-Verify': 'secret' },
      })
    );

    const [req, init] = upstream.mock.calls[0];
    expect(req.url).toBe(`${ORIGIN}/en/calories/pho?_edge=crawler`);
    expect(req.headers.get('X-Origin-Verify')).toBe('secret');
    expect(init?.cf).toMatchObject({ cacheEverything: true });
  });

  it.each([
    [
      'https://kallo.fit/en/docs/overview?_edge=crawler',
      'https://kallo.fit/en/docs/overview',
    ],
    ['/en/docs/overview?_edge=crawler', '/en/docs/overview'],
    ['/en/docs/overview?a=1&_edge=crawler', '/en/docs/overview?a=1'],
    ['/en/docs/overview', '/en/docs/overview'],
  ])('rewrites a redirect to %s as %s', async (location, expected) => {
    upstream.mockResolvedValueOnce(
      new Response(null, { status: 307, headers: { location } })
    );
    const res = await fetchCrawlerCopy(new Request(`${ORIGIN}/en/docs`));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(expected);
  });
});
