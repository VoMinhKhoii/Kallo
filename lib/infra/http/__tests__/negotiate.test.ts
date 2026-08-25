import { describe, expect, it } from 'vitest';
import { markdownAlternatePath, negotiate } from '@/lib/infra/http/negotiate';

const MD = 'text/markdown';

function ask(pathname: string, accept: string | null = MD, extra = {}) {
  return negotiate({ pathname, accept, method: 'GET', ...extra });
}

describe('negotiate', () => {
  it('never negotiates an RSC payload request', () => {
    // RSC fetches advertise `text/x-component` and nothing else, so without
    // this they land in the 406 branch and every client-side navigation on the
    // site breaks. Detected from Accept, not the `RSC` header — Next strips
    // that before middleware ever sees it.
    for (const accept of [
      'text/x-component',
      'text/x-component;q=1, */*;q=0.1',
      'TEXT/X-COMPONENT',
    ]) {
      expect(ask('/en/docs/overview', accept), accept).toEqual({
        kind: 'pass',
      });
      expect(ask('/en', accept), accept).toEqual({ kind: 'pass' });
      expect(ask('/en/nope', accept), accept).toEqual({ kind: 'pass' });
    }
  });

  it('never negotiates a non-GET request', () => {
    expect(ask('/en/docs/overview', MD, { method: 'POST' })).toEqual({
      kind: 'pass',
    });
  });

  it('passes through anything with no locale prefix', () => {
    // `/` and `/api/...` are intl's or the route handler's business.
    expect(ask('/')).toEqual({ kind: 'pass' });
    expect(ask('/nope')).toEqual({ kind: 'pass' });
  });

  it('rewrites a docs page to its markdown variant', () => {
    expect(ask('/en/docs/overview')).toEqual({
      kind: 'markdown',
      rewriteTo: '/md/en/docs/overview',
    });
    expect(ask('/vi/docs/logging/barcode')).toEqual({
      kind: 'markdown',
      rewriteTo: '/md/vi/docs/logging/barcode',
    });
  });

  it('rewrites the landing page to its markdown variant', () => {
    expect(ask('/en')).toEqual({ kind: 'markdown', rewriteTo: '/md/en/index' });
  });

  it('serves HTML when HTML is what was asked for', () => {
    expect(ask('/en/docs/overview', 'text/html')).toEqual({ kind: 'pass' });
    expect(ask('/en/docs/overview', '*/*')).toEqual({ kind: 'pass' });
    expect(ask('/en/docs/overview', null)).toEqual({ kind: 'pass' });
  });

  it('honours an explicit .md URL whatever the Accept header says', () => {
    // This is what `Link: rel="alternate"` points at, and a crawler following
    // that link may send no Accept header at all.
    expect(ask('/en/docs/overview.md', null)).toEqual({
      kind: 'markdown',
      rewriteTo: '/md/en/docs/overview',
    });
    expect(ask('/en/docs/overview.md', 'text/html')).toEqual({
      kind: 'markdown',
      rewriteTo: '/md/en/docs/overview',
    });
    expect(ask('/en.md', null)).toEqual({
      kind: 'markdown',
      rewriteTo: '/md/en/index',
    });
  });

  it('404s an unknown .md URL in markdown', () => {
    expect(ask('/en/docs/not-a-real-page.md', null)).toEqual({
      kind: 'markdown-not-found',
      rewriteTo: '/md/en/not-found',
    });
  });

  it('answers an unknown path with a markdown 404', () => {
    expect(ask('/en/nope')).toEqual({
      kind: 'markdown-not-found',
      rewriteTo: '/md/en/not-found',
    });
    expect(ask('/en/docs/no-such-doc')).toEqual({
      kind: 'markdown-not-found',
      rewriteTo: '/md/en/not-found',
    });
  });

  it('lets real pages with no markdown form fall through to HTML', () => {
    // These exist; they simply have no markdown representation. Answering with
    // a 404 would be a lie about the URL.
    for (const path of [
      '/en/dashboard',
      '/en/settings',
      '/vi/circle/friends',
      '/en/invite/abc',
      '/en/reset-password',
    ]) {
      expect(ask(path)).toEqual({ kind: 'pass' });
    }
  });

  it('returns 406 only where a markdown variant is on offer', () => {
    expect(ask('/en/docs/overview', 'application/pdf')).toEqual({
      kind: 'not-acceptable',
    });
    expect(ask('/en', 'application/pdf')).toEqual({ kind: 'not-acceptable' });
    // Not eager elsewhere: a spec-correct default beats rejecting a client over
    // a header it probably did not mean literally.
    expect(ask('/en/dashboard', 'application/pdf')).toEqual({ kind: 'pass' });
    expect(ask('/en/nope', 'application/pdf')).toEqual({ kind: 'pass' });
  });
});

describe('markdownAlternatePath', () => {
  it('names the .md sibling for pages that have one', () => {
    expect(markdownAlternatePath('/en/docs/overview')).toBe(
      '/en/docs/overview.md'
    );
    expect(markdownAlternatePath('/vi')).toBe('/vi.md');
  });

  it('is null for everything else', () => {
    expect(markdownAlternatePath('/en/dashboard')).toBeNull();
    expect(markdownAlternatePath('/en/docs/no-such-doc')).toBeNull();
    expect(markdownAlternatePath('/')).toBeNull();
  });
});
