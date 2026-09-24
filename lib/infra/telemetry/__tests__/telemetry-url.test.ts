import { describe, expect, it } from 'vitest';
import { telemetryUrl } from '../telemetry-url';

// Route matching itself is covered by route-template's own tests; these pin
// what telemetry layers on top of it.
describe('telemetryUrl', () => {
  it('keeps origin + route template of our URLs, dropping query and hash', () => {
    expect(
      telemetryUrl('https://kallo.fit/vi/invite/secret?token=x#code=y')
    ).toBe('https://kallo.fit/vi/invite/:param');
  });

  it('redacts identifiers in API paths too, not only pages', () => {
    expect(
      telemetryUrl('https://kallo.fit/api/v1/groups/shares/share-123')
    ).toBe('https://kallo.fit/api/v1/groups/shares/:param');
  });

  it('keeps only the shape of a third-party path', () => {
    expect(telemetryUrl('https://abc.supabase.co/rest/v1/meals?id=eq.42')).toBe(
      'https://abc.supabase.co/:param/:param/:param'
    );
  });

  it('templates a relative path and drops its query', () => {
    expect(telemetryUrl('/en/circle/g/group-2?tab=x')).toBe(
      '/en/circle/g/:param'
    );
  });

  it.each([
    '$direct',
    'about:blank',
    'data:text/plain,phở',
    '',
  ])('drops %j instead of passing it through', (value) => {
    expect(telemetryUrl(value)).toBe('');
  });
});
