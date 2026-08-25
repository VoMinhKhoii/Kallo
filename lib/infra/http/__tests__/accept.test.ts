import { describe, expect, it } from 'vitest';
import {
  appendVaryAccept,
  MEDIA_HTML,
  MEDIA_MARKDOWN,
  preferredType,
} from '@/lib/infra/http/accept';

describe('preferredType', () => {
  it('serves HTML when there is no constraint', () => {
    // A missing header means "no preference", not "nothing works" — the single
    // most common way content negotiation is got wrong.
    expect(preferredType(null)).toBe(MEDIA_HTML);
    expect(preferredType('')).toBe(MEDIA_HTML);
    expect(preferredType('   ')).toBe(MEDIA_HTML);
    expect(preferredType('*/*')).toBe(MEDIA_HTML);
  });

  it('serves what was asked for', () => {
    expect(preferredType('text/markdown')).toBe(MEDIA_MARKDOWN);
    expect(preferredType('text/html')).toBe(MEDIA_HTML);
  });

  it('is case-insensitive about the media type', () => {
    expect(preferredType('TEXT/MARKDOWN')).toBe(MEDIA_MARKDOWN);
  });

  it('ranks by q-value', () => {
    expect(preferredType('text/markdown;q=0.1, text/html;q=0.9')).toBe(
      MEDIA_HTML
    );
    expect(preferredType('text/markdown;q=0.9, text/html;q=0.1')).toBe(
      MEDIA_MARKDOWN
    );
  });

  it('breaks q-value ties on client order', () => {
    expect(preferredType('text/markdown, text/html')).toBe(MEDIA_MARKDOWN);
    expect(preferredType('text/html, text/markdown')).toBe(MEDIA_HTML);
  });

  it('treats q=0 as an explicit rejection', () => {
    expect(preferredType('text/markdown;q=0, text/html')).toBe(MEDIA_HTML);
    expect(preferredType('text/html;q=0, text/markdown')).toBe(MEDIA_MARKDOWN);
  });

  it('lets a specific range override a wildcard regardless of q', () => {
    // RFC 9110 §12.5.1. Without this, `text/html;q=0, */*` would keep HTML
    // alive through the wildcard and defeat the explicit rejection.
    expect(preferredType('text/html;q=0, */*')).toBe(MEDIA_MARKDOWN);
    expect(preferredType('text/markdown;q=0, */*')).toBe(MEDIA_HTML);
  });

  it('honours a type wildcard', () => {
    expect(preferredType('text/*')).toBe(MEDIA_HTML);
  });

  it('returns null only when nothing is acceptable', () => {
    expect(preferredType('application/pdf')).toBeNull();
    expect(preferredType('image/png, application/json')).toBeNull();
    expect(preferredType('text/html;q=0, text/markdown;q=0')).toBeNull();
  });

  it('ignores a malformed q parameter rather than dropping the entry', () => {
    expect(preferredType('text/markdown;q=banana')).toBe(MEDIA_MARKDOWN);
  });

  it('clamps q outside 0..1', () => {
    expect(preferredType('text/markdown;q=5, text/html;q=1')).toBe(
      MEDIA_MARKDOWN
    );
    expect(preferredType('text/markdown;q=-1, text/html')).toBe(MEDIA_HTML);
  });
});

describe('appendVaryAccept', () => {
  it('sets Vary when there is none', () => {
    const headers = new Headers();
    appendVaryAccept(headers);
    expect(headers.get('Vary')).toBe('Accept');
  });

  it('preserves what is already there', () => {
    // Next sets its own router tokens; clobbering them breaks the router cache.
    const headers = new Headers({ Vary: 'rsc, Accept-Encoding' });
    appendVaryAccept(headers);
    expect(headers.get('Vary')).toBe('rsc, Accept-Encoding, Accept');
  });

  it('does not add Accept twice', () => {
    const headers = new Headers({ Vary: 'accept, Accept-Encoding' });
    appendVaryAccept(headers);
    expect(headers.get('Vary')).toBe('accept, Accept-Encoding');
  });

  it('leaves Vary: * alone', () => {
    // `*` already means "do not cache"; narrowing it would be a regression.
    const headers = new Headers({ Vary: '*' });
    appendVaryAccept(headers);
    expect(headers.get('Vary')).toBe('*');
  });
});
