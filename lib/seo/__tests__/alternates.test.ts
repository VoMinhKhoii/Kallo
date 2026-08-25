import { describe, expect, it } from 'vitest';
import { alternateLanguages } from '../alternates';

describe('alternateLanguages', () => {
  it('uses the prefixed English page as x-default', () => {
    expect(alternateLanguages('/docs/logging/describe-a-meal')).toEqual({
      en: 'https://kallo.fit/en/docs/logging/describe-a-meal',
      vi: 'https://kallo.fit/vi/docs/logging/describe-a-meal',
      'x-default': 'https://kallo.fit/en/docs/logging/describe-a-meal',
    });
  });

  it('builds the same locale set for the landing page', () => {
    expect(alternateLanguages('')).toEqual({
      en: 'https://kallo.fit/en',
      vi: 'https://kallo.fit/vi',
      'x-default': 'https://kallo.fit/en',
    });
  });
});
