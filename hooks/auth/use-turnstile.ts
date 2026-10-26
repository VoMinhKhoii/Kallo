'use client';

import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  loadTurnstile,
  TURNSTILE_ACTION,
  type TurnstileApi,
} from '@/lib/infra/security/turnstile-script';

export interface TurnstileState {
  /** Where the widget renders. Invisible unless Cloudflare needs a click. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** The current token, or null while pending / when not configured. */
  token: string | null;
  /** False when no site key is configured (local dev): send without one. */
  required: boolean;
  /** The script was blocked or the check errored. */
  failed: boolean;
  /** Cloudflare is showing its checkbox, so the slot takes up room. */
  interactive: boolean;
  /** Spend the current token and start on a fresh one. */
  reset: () => void;
}

/**
 * One Turnstile widget for one form. Tokens are single-use and live 300 s;
 * the widget refreshes an expired one by itself, and `reset` is called after
 * every send so the next send has its own.
 */
export function useTurnstile(
  siteKey: string | null,
  language: string
): TurnstileState {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<TurnstileApi | null>(null);
  const widgetRef = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;

    loadTurnstile()
      .then((api) => {
        const container = containerRef.current;
        if (cancelled || !container) return;
        apiRef.current = api;
        widgetRef.current = api.render(container, {
          sitekey: siteKey,
          action: TURNSTILE_ACTION,
          appearance: 'interaction-only',
          size: 'flexible',
          language,
          callback: (value) => {
            setFailed(false);
            setToken(value);
          },
          'expired-callback': () => setToken(null),
          'error-callback': () => {
            setToken(null);
            setFailed(true);
          },
          'before-interactive-callback': () => setInteractive(true),
          'after-interactive-callback': () => setInteractive(false),
        });
      })
      .catch((error) => {
        console.error('[turnstile] widget failed to load', error);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (widgetRef.current) apiRef.current?.remove(widgetRef.current);
      widgetRef.current = null;
    };
  }, [siteKey, language]);

  const reset = useCallback(() => {
    setToken(null);
    if (widgetRef.current) apiRef.current?.reset(widgetRef.current);
  }, []);

  return {
    containerRef,
    token,
    required: siteKey !== null,
    failed,
    interactive,
    reset,
  };
}
