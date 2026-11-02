import { describe, expect, it } from 'vitest';
import { buildUserContext } from '@/lib/ai/adapters/user-context';

describe('buildUserContext country bounds', () => {
  it('bounds both stored countries before any AI prompt reads them', () => {
    const profile = {
      countryOfOrigin: 'a'.repeat(1000),
      countryOfResidence: 'b'.repeat(1000),
    } as Parameters<typeof buildUserContext>[0];
    const context = buildUserContext(profile);
    expect(context.countryOfOrigin).toBe('a'.repeat(100));
    expect(context.countryOfResidence).toBe('b'.repeat(100));
  });
  it('keeps null and normal country names', () => {
    const context = buildUserContext({
      countryOfOrigin: null,
      countryOfResidence: 'Việt Nam',
    } as Parameters<typeof buildUserContext>[0]);
    expect(context.countryOfOrigin).toBeNull();
    expect(context.countryOfResidence).toBe('Việt Nam');
  });
});
