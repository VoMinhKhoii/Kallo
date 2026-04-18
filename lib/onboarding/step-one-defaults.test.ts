import { describe, expect, it } from 'vitest';
import { buildStepOneDefaults } from './step-one-defaults';

describe('buildStepOneDefaults', () => {
  it('uses draft locale first when present', () => {
    expect(
      buildStepOneDefaults({
        activeLocale: 'en',
        countryOfOrigin: 'Vietnam',
        countryOfResidence: 'Australia',
        draft: {
          countryOfOrigin: 'Japan',
          countryOfResidence: 'Singapore',
          preferredLocale: 'vi',
        },
        profilePreferredLocale: 'en',
      })
    ).toEqual({
      countryOfOrigin: 'Japan',
      countryOfResidence: 'Singapore',
      preferredLocale: 'vi',
    });
  });

  it('defaults step 1 locale to the active route locale', () => {
    expect(
      buildStepOneDefaults({
        activeLocale: 'vi',
        countryOfOrigin: null,
        countryOfResidence: null,
        draft: null,
        profilePreferredLocale: null,
      })
    ).toEqual({
      countryOfOrigin: null,
      countryOfResidence: null,
      preferredLocale: 'vi',
    });
  });

  it('prefers the active route locale over a conflicting saved profile locale', () => {
    expect(
      buildStepOneDefaults({
        activeLocale: 'vi',
        countryOfOrigin: 'Vietnam',
        countryOfResidence: 'Australia',
        draft: null,
        profilePreferredLocale: 'en',
      })
    ).toEqual({
      countryOfOrigin: 'Vietnam',
      countryOfResidence: 'Australia',
      preferredLocale: 'vi',
    });
  });

  it('falls back to saved profile locale when active locale is unavailable', () => {
    expect(
      buildStepOneDefaults({
        activeLocale: 'fr',
        countryOfOrigin: 'Vietnam',
        countryOfResidence: 'Australia',
        draft: null,
        profilePreferredLocale: 'vi',
      })
    ).toEqual({
      countryOfOrigin: 'Vietnam',
      countryOfResidence: 'Australia',
      preferredLocale: 'vi',
    });
  });

  it('falls back to the default locale last', () => {
    expect(
      buildStepOneDefaults({
        activeLocale: null,
        countryOfOrigin: null,
        countryOfResidence: null,
        draft: null,
        profilePreferredLocale: 'fr',
      })
    ).toEqual({
      countryOfOrigin: null,
      countryOfResidence: null,
      preferredLocale: 'en',
    });
  });
});
