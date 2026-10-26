'use client';

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';

export type AuthTab = 'sign-in' | 'sign-up';

/**
 * Which screen the dialog is showing:
 * - `auth` — Google, then the email field that asks for a code
 * - `code` — type the 6-digit code sent to `codeEmail`, with resend
 *
 * Email sign-in is code-only, so there is no sign-up form and no password
 * reset; the tab only picks the title ("Welcome back" / "Create your account").
 */
export type AuthPanel = 'auth' | 'code';

interface AuthDialogContextValue {
  open: boolean;
  tab: AuthTab;
  panel: AuthPanel;
  /** The address the code went to, shown on the code panel; resend targets it. */
  codeEmail: string | null;
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
  /**
   * Cloudflare Turnstile site key, a runtime env var passed down like the
   * Google client ID. Null (local dev) sends code requests without a token.
   */
  turnstileSiteKey: string | null;
  openDialog: (tab?: AuthTab) => void;
  closeDialog: () => void;
  showAuth: () => void;
  showCode: (email: string) => void;
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
  turnstileSiteKey: string | null;
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
  turnstileSiteKey = null,
  initialOpen = false,
  initialTab = 'sign-in',
}: {
  children: React.ReactNode;
  /** A validated return path (e.g. arriving from an invite link). */
  next?: string | null;
  /** `process.env.GOOGLE_WEB_CLIENT_ID`, resolved by the server page. */
  googleClientId?: string | null;
  /** `process.env.TURNSTILE_SITE_KEY`, resolved by the server page. */
  turnstileSiteKey?: string | null;
  initialOpen?: boolean;
  initialTab?: AuthTab;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [nextPath, setNextPath] = useState(next);
  const [clientId, setClientId] = useState(googleClientId);
  const [siteKey, setSiteKey] = useState(turnstileSiteKey);
  const [panel, setPanel] = useState<AuthPanel>('auth');
  const [codeEmail, setCodeEmail] = useState<string | null>(null);

  // Whether the dialog is open because the URL asked for it (`?auth=` /
  // `?next=`), as opposed to the reader pressing a button. Only a URL-driven
  // dialog may be closed by the URL losing that intent.
  const openedByRequest = useRef(false);

  const showDialog = useCallback((t: AuthTab) => {
    setTab(t);
    setPanel('auth');
    setOpen(true);
  }, []);

  const openDialog = useCallback(
    (t: AuthTab = 'sign-up') => {
      openedByRequest.current = false;
      showDialog(t);
    },
    [showDialog]
  );

  const closeDialog = useCallback(() => {
    openedByRequest.current = false;
    setOpen(false);
    // Reset the flow so the next open starts on the credentials screen.
    setPanel('auth');
    setCodeEmail(null);
  }, []);

  const showAuth = useCallback(() => setPanel('auth'), []);
  const showCode = useCallback((email: string) => {
    setCodeEmail(email);
    setPanel('code');
  }, []);

  const applyRequestConfig = useCallback(
    ({
      googleClientId: id,
      turnstileSiteKey: key,
      next: path,
      openTab,
    }: AuthRequestValues) => {
      setClientId(id);
      setSiteKey(key);
      if (path !== undefined) setNextPath(path);
      if (openTab) {
        openedByRequest.current = true;
        showDialog(openTab);
      } else if (openTab === null && openedByRequest.current) {
        // Under Cache Components the page — and this provider — survive a
        // navigation from `/en?auth=sign-in` back to `/en` (history, or a
        // link), so the new URL's missing intent has to close the dialog
        // the old URL opened. A dialog the reader opened is left alone.
        closeDialog();
      }
    },
    [showDialog, closeDialog]
  );

  return (
    <AuthDialogContext.Provider
      value={{
        open,
        tab,
        panel,
        codeEmail,
        next: nextPath,
        googleClientId: clientId,
        turnstileSiteKey: siteKey,
        openDialog,
        closeDialog,
        showAuth,
        showCode,
        applyRequestConfig,
      }}
    >
      {children}
    </AuthDialogContext.Provider>
  );
}
