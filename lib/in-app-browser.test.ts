import { describe, expect, it } from 'vitest';
import {
  chromeIntentUrl,
  isAndroid,
  isInAppBrowser,
} from '@/lib/in-app-browser';

describe('isInAppBrowser', () => {
  it.each([
    [
      'Messenger iOS',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 [FBAN/FBIOS;FBAV/467.0.0.28.109;FBBV/610977308]',
    ],
    [
      'Facebook Android',
      'Mozilla/5.0 (Linux; Android 14; SM-S918B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/468.0.0.35.108;]',
    ],
    [
      'Instagram',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 Instagram 336.0.0.29.89',
    ],
    [
      'Zalo',
      'Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 Zalo',
    ],
    [
      'TikTok (musical_ly)',
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.0.0 Mobile Safari/537.36 musical_ly_2023 TTWebView',
    ],
    [
      'WeChat (MicroMessenger)',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 MicroMessenger/8.0.49',
    ],
    [
      'generic Android webview',
      'Mozilla/5.0 (Linux; Android 12; Nokia G20; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.0.0 Mobile Safari/537.36',
    ],
  ])('returns true for %s', (_label, ua) => {
    expect(isInAppBrowser(ua)).toBe(true);
  });

  it.each([
    [
      'desktop Chrome',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    ],
    [
      'iOS Safari',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    ],
    [
      'Android Chrome (no wv)',
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    ],
    ['empty string', ''],
  ])('returns false for %s', (_label, ua) => {
    expect(isInAppBrowser(ua)).toBe(false);
  });
});

describe('isAndroid', () => {
  it('returns true for an Android UA', () => {
    expect(
      isAndroid(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
      )
    ).toBe(true);
  });

  it('returns false for iOS Safari', () => {
    expect(
      isAndroid(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
      )
    ).toBe(false);
  });
});

describe('chromeIntentUrl', () => {
  it('builds an intent URL with host, path and query plus a fallback', () => {
    expect(chromeIntentUrl('https://nham.app/en/logging?ref=fb')).toBe(
      'intent://nham.app/en/logging?ref=fb#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fnham.app%2Fen%2Flogging%3Fref%3Dfb;end'
    );
  });
});
