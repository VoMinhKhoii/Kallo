'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { useRouter } from '@/i18n/navigation';
import { isDuplicateEmailError } from '@/lib/auth/duplicate-email';
import {
  createNoncePair,
  type GoogleCredentialResponse,
  loadGoogleIdentity,
} from '@/lib/auth/google-identity';
import { safeNextPath } from '@/lib/auth/safe-next';
import { createClient } from '@/lib/supabase/client';

/** Grace period after focus returns, so a credential callback can land first. */
const POPUP_SETTLE_MS = 250;

/**
 * Google sign-in that keeps consent on our own origin.
 *
 * GIS is asked for an ID token (`signInWithIdToken`) instead of bouncing the
 * browser through GoTrue's `/authorize` — so Google's picker is labelled with
 * kallo.fit rather than the Supabase project domain. This is the web twin of
 * the Flutter flow in `auth_form_controller.dart`.
 *
 * GIS has no API to open the account picker programmatically, so we render its
 * own button into a clipped container and forward our styled button's click to
 * it (the documented pattern for custom-branded buttons). Everything that can
 * go wrong with that — script blocked, client ID unset, button markup changed
 * upstream — reports `pickerOpened === false`, and the caller falls back to the
 * redirect flow, which still signs the user in.
 */
export function useGoogleIdentity() {
  const t = useTranslations('auth.dialog');
  const locale = useLocale();
  const router = useRouter();
  const { next, googleClientId, closeDialog } = useAuthDialog();

  const containerRef = useRef<HTMLDivElement>(null);
  const rawNonceRef = useRef<string | null>(null);
  /** True from credential-received until navigation, so the popup-closed
   * watcher never clears a spinner that a live token exchange still owns. */
  const exchangingRef = useRef(false);
  const focusWatcherRef = useRef<(() => void) | null>(null);
  const [loading, setLoading] = useState(false);

  // The credential arrives from a GIS callback registered once at mount, so it
  // reads its collaborators through a ref rather than closing over stale state.
  const exchangeRef = useRef<(idToken: string) => Promise<void>>(
    async () => {}
  );

  const exchange = useCallback(
    async (idToken: string) => {
      exchangingRef.current = true;
      setLoading(true);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
        // Supabase re-hashes this and compares it with the token's claim.
        ...(rawNonceRef.current ? { nonce: rawNonceRef.current } : {}),
      });

      if (error) {
        console.error('[google-sign-in] signInWithIdToken failed', error);
        toast.error(
          isDuplicateEmailError(error.message)
            ? t('accountExists')
            : t('googleError')
        );
        exchangingRef.current = false;
        setLoading(false);
        return;
      }

      closeDialog();
      // Mirrors the password flow: a hard navigation for `next` so the server
      // re-reads the fresh session cookie on an invite page.
      const safeNext = safeNextPath(next);
      if (safeNext) {
        window.location.assign(safeNext);
        return;
      }
      router.push('/logging');
      router.refresh();
    },
    [closeDialog, next, router, t]
  );
  // Assigned in an effect, never during render: the GIS callback only ever
  // fires after a click, so it always reads a committed `exchange`.
  useEffect(() => {
    exchangeRef.current = exchange;
  }, [exchange]);

  useEffect(() => {
    if (!googleClientId) return;
    let cancelled = false;
    const container = containerRef.current;

    (async () => {
      try {
        const [google, nonce] = await Promise.all([
          loadGoogleIdentity(),
          createNoncePair(),
        ]);
        if (cancelled || !container) return;
        rawNonceRef.current = nonce.raw;

        google.initialize({
          client_id: googleClientId,
          nonce: nonce.hashed,
          auto_select: false,
          cancel_on_tap_outside: true,
          callback: (response: GoogleCredentialResponse) => {
            if (!response.credential) return;
            void exchangeRef.current(response.credential);
          },
          error_callback: (error) => {
            // Fires when Google blocks or closes its popup. Best-effort: the
            // focus watcher in `signIn` clears the spinner regardless.
            console.error('[google-sign-in] GIS error', error);
            exchangingRef.current = false;
            setLoading(false);
          },
        });

        // Rendered, then hidden by opacity: GIS refuses to render into a
        // detached or display:none node, and its button is the only way to open
        // the picker.
        google.renderButton(container, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          locale,
        });
        // GIS's button is focusable, and an invisible tab stop inside the auth
        // dialog's focus trap would strand keyboard users on a control they
        // cannot see. The styled button is the real control.
        for (const node of container.querySelectorAll<HTMLElement>(
          '[tabindex], [role="button"]'
        )) {
          node.tabIndex = -1;
        }
      } catch (error) {
        console.error('[google-sign-in] GIS unavailable', error);
      }
    })();

    return () => {
      cancelled = true;
      // React re-runs effects on remount; without this the second render
      // appends a second GIS button to the same container.
      if (container) container.innerHTML = '';
    };
  }, [googleClientId, locale]);

  /**
   * Forwards a click to the rendered GIS button. Returns false when the picker
   * could not be opened, which is the caller's cue to take the redirect flow.
   */
  const openPicker = useCallback((): boolean => {
    const button =
      containerRef.current?.querySelector<HTMLElement>('[role="button"]');
    if (!button) return false;
    button.click();
    return true;
  }, []);

  const signIn = useCallback((): boolean => {
    setLoading(true);
    if (!openPicker()) {
      setLoading(false);
      return false;
    }

    // The picker is a separate window, so closing it without choosing an
    // account returns focus here with no callback. Clearing the spinner on that
    // focus keeps the button usable; a live exchange holds it via `exchanging`.
    const onFocus = () => {
      window.removeEventListener('focus', onFocus);
      focusWatcherRef.current = null;
      // A beat of slack so a credential callback racing the focus event wins.
      setTimeout(() => {
        if (!exchangingRef.current) setLoading(false);
      }, POPUP_SETTLE_MS);
    };
    focusWatcherRef.current = onFocus;
    window.addEventListener('focus', onFocus);
    return true;
  }, [openPicker]);

  // The dialog can be dismissed while the picker is still open; the watcher
  // above would otherwise outlive the component that owns its state.
  useEffect(
    () => () => {
      if (focusWatcherRef.current) {
        window.removeEventListener('focus', focusWatcherRef.current);
        focusWatcherRef.current = null;
      }
    },
    []
  );

  return { containerRef, loading, setLoading, signIn };
}
