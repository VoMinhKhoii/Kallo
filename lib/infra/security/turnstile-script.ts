/**
 * Browser loader for Cloudflare Turnstile's widget script.
 *
 * The widget proves to our auth proxy that a person, not a script, asked for
 * a sign-in code (`lib/infra/security/turnstile.ts` is the server half). Its
 * token is single-use, so the caller resets the widget after every send.
 *
 * The page hosting it must allow `https://challenges.cloudflare.com` in
 * `script-src` and `frame-src` (`lib/infra/security/csp.ts`).
 */

const TURNSTILE_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** The action every Kallo widget declares; shows up in Turnstile analytics. */
export const TURNSTILE_ACTION = 'auth-email';

export interface TurnstileRenderOptions {
  sitekey: string;
  action?: string;
  /** `interaction-only`: invisible unless Cloudflare needs a click. */
  appearance?: 'always' | 'execute' | 'interaction-only';
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'flexible' | 'compact';
  language?: string;
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: (code: string) => void;
  'before-interactive-callback'?: () => void;
  'after-interactive-callback'?: () => void;
}

export interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileRenderOptions): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * Injected once per document; cleared on failure so a later mount can retry
 * a transient network error.
 */
let scriptPromise: Promise<TurnstileApi> | null = null;

export function loadTurnstile(): Promise<TurnstileApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Turnstile is browser-only'));
  }
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TURNSTILE_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.turnstile) {
        resolve(window.turnstile);
        return;
      }
      scriptPromise = null;
      script.remove();
      reject(new Error('Turnstile loaded without window.turnstile'));
    };
    script.onerror = () => {
      // Ad blockers and some networks block this host outright.
      scriptPromise = null;
      script.remove();
      reject(new Error('Turnstile script failed to load'));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/** Test seam: forget the injected-script memo. */
export function resetTurnstileLoader(): void {
  scriptPromise = null;
}
