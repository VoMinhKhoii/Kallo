'use client';

import { createContext, useCallback, useContext, useState } from 'react';

export type AuthTab = 'sign-in' | 'sign-up';

/**
 * Which screen the dialog is showing:
 * - `auth`        — credentials (sign-in / sign-up tabs + Google)
 * - `forgot`      — request a password-reset link
 * - `check-email` — persistent "we sent you a link" state (after sign-up
 *                   confirmation OR a reset request), with resend
 */
export type AuthPanel = 'auth' | 'forgot' | 'check-email';

/** What the check-email panel is confirming, so "resend" calls the right API. */
export type CheckEmailMode = 'confirm' | 'reset';

interface AuthDialogContextValue {
  open: boolean;
  tab: AuthTab;
  panel: AuthPanel;
  /** The address shown on the check-email panel, and what resend targets. */
  checkEmail: { email: string; mode: CheckEmailMode } | null;
  /** In-app path to return to after auth (e.g. an invite link), or null. */
  next: string | null;
  /**
   * Google **Web** OAuth client ID, read from the server env and passed down
   * (not `NEXT_PUBLIC_*`) so it stays a per-environment runtime value instead
   * of being baked into the image at build time — same reasoning as the
   * RevenueCat web key in `app/api/v1/account/billing-config`. Null disables
   * the ID-token flow and leaves Google sign-in on the redirect fallback.
   */
  googleClientId: string | null;
  openDialog: (tab?: AuthTab) => void;
  closeDialog: () => void;
  setTab: (tab: AuthTab) => void;
  showAuth: () => void;
  showForgot: () => void;
  showCheckEmail: (email: string, mode: CheckEmailMode) => void;
  /** Applies the request-time values; see `AuthRequestConfig`. */
  applyRequestConfig: (config: AuthRequestValues) => void;
}

/**
 * The parts of the provider's state that depend on the request: the Google
 * client ID (a runtime env var) and, on the landing page, the `?auth=` /
 * `?next=` intent. A prerendered page cannot know them, so they arrive after
 * the static shell from `AuthRequestConfig`, streamed behind `<Suspense>`.
 */
export interface AuthRequestValues {
  googleClientId: string | null;
  next?: string | null;
  /** Open the dialog on this tab, e.g. arriving from an invite link. */
  openTab?: AuthTab | null;
}

const AuthDialogContext = createContext<AuthDialogContextValue | null>(null);

export function useAuthDialog() {
  const ctx = useContext(AuthDialogContext);
  if (!ctx) {
    throw new Error('useAuthDialog must be used within AuthProvider');
  }
  return ctx;
}

export function AuthProvider({
  children,
  next = null,
  googleClientId = null,
  initialOpen = false,
  initialTab = 'sign-in',
}: {
  children: React.ReactNode;
  /** A validated return path (e.g. arriving from an invite link). */
  next?: string | null;
  /** `process.env.GOOGLE_WEB_CLIENT_ID`, resolved by the server page. */
  googleClientId?: string | null;
  initialOpen?: boolean;
  initialTab?: AuthTab;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [nextPath, setNextPath] = useState(next);
  const [clientId, setClientId] = useState(googleClientId);
  const [panel, setPanel] = useState<AuthPanel>('auth');
  const [checkEmail, setCheckEmail] = useState<{
    email: string;
    mode: CheckEmailMode;
  } | null>(null);

  const openDialog = useCallback((t: AuthTab = 'sign-up') => {
    setTab(t);
    setPanel('auth');
    setOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setOpen(false);
    // Reset the flow so the next open starts on the credentials screen.
    setPanel('auth');
    setCheckEmail(null);
  }, []);

  const showAuth = useCallback(() => setPanel('auth'), []);
  const showForgot = useCallback(() => setPanel('forgot'), []);
  const showCheckEmail = useCallback((email: string, mode: CheckEmailMode) => {
    setCheckEmail({ email, mode });
    setPanel('check-email');
  }, []);

  const applyRequestConfig = useCallback(
    ({ googleClientId: id, next: path, openTab }: AuthRequestValues) => {
      setClientId(id);
      if (path !== undefined) setNextPath(path);
      if (openTab) openDialog(openTab);
    },
    [openDialog]
  );

  return (
    <AuthDialogContext.Provider
      value={{
        open,
        tab,
        panel,
        checkEmail,
        next: nextPath,
        googleClientId: clientId,
        openDialog,
        closeDialog,
        setTab,
        showAuth,
        showForgot,
        showCheckEmail,
        applyRequestConfig,
      }}
    >
      {children}
    </AuthDialogContext.Provider>
  );
}
