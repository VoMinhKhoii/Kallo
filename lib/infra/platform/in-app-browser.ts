/**
 * In-app browser (webview) detection.
 *
 * Google's OAuth endpoint rejects embedded webviews with
 * "Error 403: disallowed_useragent", so we detect the common Vietnamese and
 * global in-app browsers and steer users to the email form or an external
 * browser instead. All functions are SSR-safe: they default to the current
 * `navigator.userAgent` on the client and treat an empty string as "not a
 * webview".
 */

// One case-insensitive pass over the UA. Grouped by app for readability.
const IN_APP_BROWSER_RE =
  /FBAN|FBAV|FB_IAB|FBIOS|MessengerForiOS|Orca-Android|Instagram|Zalo|musical_ly|Bytedance|TTWebView|\bLine\/|MicroMessenger|Twitter|LinkedInApp|; wv\)/i;

function currentUserAgent(): string {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent;
}

/** True when the UA belongs to a known in-app browser / embedded webview. */
export function isInAppBrowser(ua: string = currentUserAgent()): boolean {
  if (!ua) return false;
  return IN_APP_BROWSER_RE.test(ua);
}

/** True when the UA is an Android device. */
export function isAndroid(ua: string = currentUserAgent()): boolean {
  if (!ua) return false;
  return /android/i.test(ua);
}

/**
 * Build an Android `intent://` URL that opens `href` in Chrome, falling back
 * to the original URL if Chrome is unavailable.
 */
export function chromeIntentUrl(href: string): string {
  const { host, pathname, search } = new URL(href);
  return `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href)};end`;
}
