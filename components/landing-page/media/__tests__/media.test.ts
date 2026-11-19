import { describe, expect, it } from 'vitest';
import { appScreen, landingClip } from '../media';

describe('landingClip', () => {
  it('serves each language its own cut', () => {
    expect(landingClip('vi', 'log').src).toBe('/landing/video/vi/log.mp4');
    expect(landingClip('en', 'log').src).toBe('/landing/video/en/log.mp4');
  });

  it('gives phones a lighter cut only for the wide clips', () => {
    expect(landingClip('en', 'diff').mobileSrc).toBe(
      '/landing/video/en/diff-sm.mp4'
    );
    expect(landingClip('en', 'barcode').mobileSrc).toBeUndefined();
  });
});

describe('appScreen', () => {
  it('falls back to the English capture for a language without one', () => {
    expect(appScreen('fr', 'home')).toBe('/landing/app/en-home.webp');
    expect(appScreen('vi', 'home')).toBe('/landing/app/vi-home.webp');
  });
});
