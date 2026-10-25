import type { NextRequest } from 'next/server';
import { turnstileSiteKey } from '@/lib/infra/security/turnstile';
import { TURNSTILE_ACTION } from '@/lib/infra/security/turnstile-script';

/**
 * The page the iOS app loads, in a web view, to get a Turnstile token.
 *
 * Cloudflare: "For native mobile applications, Turnstile does not run
 * natively" — it has to run in a web view, on a hostname the widget allows.
 * So the app opens this page on our own origin and listens on a JavaScript
 * channel named `KalloTurnstile` for JSON messages:
 *
 *   {type:'token', token}        a fresh single-use token
 *   {type:'expired'}             the held token lapsed (Turnstile refreshes it)
 *   {type:'error', code}         the check failed or the script was blocked
 *   {type:'interactive', on}     Cloudflare is (or stops) showing its checkbox
 *   {type:'disabled'}            no site key here: send code requests without one
 *
 * The app calls `kalloTurnstileReset()` after every send. The site key is read
 * at request time, the same value the web dialog renders with, so iOS never
 * carries a copy of its own.
 */

const LANGS = new Set(['en', 'vi']);
const THEMES = new Set(['light', 'dark', 'auto']);

/** JSON for an inline <script>: no `<` can close the element early. */
function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function GET(request: NextRequest): Response {
  const params = request.nextUrl.searchParams;
  const lang = LANGS.has(params.get('lang') ?? '') ? params.get('lang') : 'en';
  const theme = THEMES.has(params.get('theme') ?? '')
    ? params.get('theme')
    : 'auto';
  const config = {
    sitekey: turnstileSiteKey(),
    action: TURNSTILE_ACTION,
    language: lang,
    theme,
  };

  const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Kallo</title>
<style>html,body{margin:0;padding:0;background:transparent}</style>
</head>
<body>
<div id="widget"></div>
<script>
(function () {
  var config = ${scriptJson(config)};
  function post(message) {
    if (window.KalloTurnstile) window.KalloTurnstile.postMessage(JSON.stringify(message));
  }
  if (!config.sitekey) { post({ type: 'disabled' }); return; }
  window.kalloTurnstileReady = function () {
    window.turnstile.render('#widget', {
      sitekey: config.sitekey,
      action: config.action,
      appearance: 'interaction-only',
      size: 'flexible',
      language: config.language,
      theme: config.theme,
      callback: function (token) { post({ type: 'token', token: token }); },
      'expired-callback': function () { post({ type: 'expired' }); },
      'error-callback': function (code) { post({ type: 'error', code: String(code) }); },
      'before-interactive-callback': function () { post({ type: 'interactive', on: true }); },
      'after-interactive-callback': function () { post({ type: 'interactive', on: false }); }
    });
  };
  window.kalloTurnstileReset = function () {
    if (window.turnstile) window.turnstile.reset('#widget');
  };
  var script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=kalloTurnstileReady';
  script.async = true;
  script.onerror = function () { post({ type: 'error', code: 'script' }); };
  document.head.appendChild(script);
})();
</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // The site key is read per request; never let a cache pin an old one.
      'cache-control': 'no-store',
    },
  });
}
