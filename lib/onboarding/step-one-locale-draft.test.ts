import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearStepOneLocaleDraft,
  readStepOneLocaleDraft,
  writeStepOneLocaleDraft,
} from './step-one-locale-draft';

describe('step-one locale draft', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('round-trips the onboarding draft', () => {
    writeStepOneLocaleDraft({
      countryOfOrigin: 'Vietnam',
      countryOfResidence: 'Australia',
      preferredLocale: 'vi',
    });

    expect(readStepOneLocaleDraft()).toEqual({
      countryOfOrigin: 'Vietnam',
      countryOfResidence: 'Australia',
      preferredLocale: 'vi',
    });
  });

  it('clears malformed JSON payloads', () => {
    sessionStorage.setItem('onboarding-step-1-locale-draft', '{bad json');

    expect(readStepOneLocaleDraft()).toBeNull();
    expect(sessionStorage.getItem('onboarding-step-1-locale-draft')).toBeNull();
  });

  it('clears parsed payloads with invalid locale values', () => {
    sessionStorage.setItem(
      'onboarding-step-1-locale-draft',
      JSON.stringify({
        countryOfOrigin: 'Vietnam',
        countryOfResidence: 'Australia',
        preferredLocale: 'fr',
      })
    );

    expect(readStepOneLocaleDraft()).toBeNull();
    expect(sessionStorage.getItem('onboarding-step-1-locale-draft')).toBeNull();
  });

  it('clears a previously stored draft', () => {
    writeStepOneLocaleDraft({
      countryOfOrigin: 'Vietnam',
      countryOfResidence: 'Australia',
      preferredLocale: 'vi',
    });

    clearStepOneLocaleDraft();

    expect(readStepOneLocaleDraft()).toBeNull();
  });

  it('returns null and no-ops when window is unavailable', () => {
    vi.stubGlobal('window', undefined);

    expect(() =>
      writeStepOneLocaleDraft({
        countryOfOrigin: 'Vietnam',
        countryOfResidence: 'Australia',
        preferredLocale: 'vi',
      })
    ).not.toThrow();
    expect(readStepOneLocaleDraft()).toBeNull();
    expect(() => clearStepOneLocaleDraft()).not.toThrow();
  });

  it('fails soft when sessionStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() =>
      writeStepOneLocaleDraft({
        countryOfOrigin: 'Vietnam',
        countryOfResidence: 'Australia',
        preferredLocale: 'vi',
      })
    ).not.toThrow();
    expect(readStepOneLocaleDraft()).toBeNull();
    expect(() => clearStepOneLocaleDraft()).not.toThrow();
  });

  it('clears parsed payloads with invalid countryOfOrigin/countryOfResidence types', () => {
    const invalids = [123, true, {}, [], undefined];
    for (const val of invalids) {
      sessionStorage.setItem(
        'onboarding-step-1-locale-draft',
        JSON.stringify({
          countryOfOrigin: val,
          countryOfResidence: 'Australia',
          preferredLocale: 'vi',
        })
      );
      expect(readStepOneLocaleDraft()).toBeNull();
      expect(
        sessionStorage.getItem('onboarding-step-1-locale-draft')
      ).toBeNull();

      sessionStorage.setItem(
        'onboarding-step-1-locale-draft',
        JSON.stringify({
          countryOfOrigin: 'Vietnam',
          countryOfResidence: val,
          preferredLocale: 'vi',
        })
      );
      expect(readStepOneLocaleDraft()).toBeNull();
      expect(
        sessionStorage.getItem('onboarding-step-1-locale-draft')
      ).toBeNull();
    }
  });
});
