import { describe, expect, it } from 'vitest';
import { routePattern, sanitizeUrl } from '../route-pattern';

describe('routePattern', () => {
  it.each([
    ['/en', '/'],
    ['/vi/', '/'],
    ['/en/dashboard', '/dashboard'],
    ['/vi/invite/abc123', '/invite/[slug]'],
    ['/en/circle/3f2a-share', '/circle/[shareId]'],
    ['/en/circle/g/group-9', '/circle/g/[groupId]'],
    ['/en/circle', '/circle'],
    ['/en/admin/feedback/42', '/admin/feedback/[id]'],
    ['/en/admin/requests/r-1/trace', '/admin/requests/[id]/trace'],
    ['/en/docs/legal/privacy', '/docs/legal/privacy'],
    ['/english-page', '/english-page'],
  ])('%s → %s', (input, expected) => {
    expect(routePattern(input)).toBe(expected);
  });
});

describe('sanitizeUrl', () => {
  const origin = 'https://kallo.fit';

  it('drops query and hash from our own URLs and patterns the path', () => {
    expect(
      sanitizeUrl('https://kallo.fit/vi/invite/secret?token=x#code=y', origin)
    ).toBe('https://kallo.fit/invite/[slug]');
  });

  it('keeps only the origin of a third-party URL', () => {
    expect(
      sanitizeUrl('https://www.google.com/search?q=kallo+weight', origin)
    ).toBe('https://www.google.com');
  });

  it('returns empty for a non-URL value', () => {
    expect(sanitizeUrl('$direct', origin)).toBe('');
  });
});
