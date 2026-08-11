/**
 * Google Identity Services (GIS) loader + nonce helpers for browser sign-in.
 *
 * Why this exists: `signInWithOAuth` hands the browser to GoTrue's
 * `/auth/v1/authorize`, so the `redirect_uri` Google receives is
 * `https://<project-ref>.supabase.co/auth/v1/callback` — and Google labels its
 * consent screen with that domain. GIS mints the ID token on our own origin
 * instead (the picker reads "kallo.fit"), and Supabase accepts it through
 * `signInWithIdToken` — the same call the Flutter app already makes, which is
 * why mobile has always shown the right brand. See
 * `apps/mobile-flutter/lib/features/auth/providers/auth_form_controller.dart`.
 *
 * Nothing here is load-bearing for sign-in: every failure path (script blocked,
 * client ID unset, button not rendered) lets the caller fall back to the
 * redirect flow, which still works — it just shows the Supabase domain.
 */

const GIS_SRC = 'https://accounts.google.com/gsi/client';

/** The credential payload GIS hands back — `credential` is the JWT ID token. */
export interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
}

/**
 * Errors GIS reports out-of-band (popup closed or blocked). Typed loosely on
 * purpose: `error_callback` is best-effort here, so an unknown `type` from a
 * future GIS release must not break the flow.
 */
export interface GoogleIdentityError {
  type?: string;
}

export interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  /** SHA-256 hex of the raw nonce; Google embeds it in the ID token. */
  nonce?: string;
  error_callback?: (error: GoogleIdentityError) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
}

export interface GoogleButtonConfiguration {
  type: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  /** Pixels. GIS caps the rendered button at 400. */
  width?: number;
  locale?: string;
}

export interface GoogleIdentityApi {
  initialize(config: GoogleIdConfiguration): void;
  renderButton(parent: HTMLElement, config: GoogleButtonConfiguration): void;
  cancel(): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdentityApi } };
  }
}

/**
 * Module-level memo so the GIS script is injected once per document even
 * though the sign-in button mounts on several pages (landing, invite).
 * Cleared on failure so a later attempt can retry a transient network error.
 */
let scriptPromise: Promise<GoogleIdentityApi> | null = null;

/** Injects `accounts.google.com/gsi/client` and resolves its `id` namespace. */
export function loadGoogleIdentity(): Promise<GoogleIdentityApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('GIS is browser-only'));
  }
  const loaded = window.google?.accounts?.id;
  if (loaded) return Promise.resolve(loaded);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<GoogleIdentityApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const api = window.google?.accounts?.id;
      if (api) {
        resolve(api);
        return;
      }
      scriptPromise = null;
      script.remove();
      reject(new Error('GIS loaded without accounts.id'));
    };
    script.onerror = () => {
      // Ad blockers and locked-down networks block this host outright; drop the
      // memo so a retry is possible, and let the caller take the redirect path.
      scriptPromise = null;
      script.remove();
      reject(new Error('GIS script failed to load'));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/** Test seam: forget the injected-script memo. */
export function resetGoogleIdentityLoader(): void {
  scriptPromise = null;
}

export interface NoncePair {
  /** Sent to Supabase, which hashes it and compares against the token claim. */
  raw: string;
  /** Sent to Google, which embeds it in the ID token's `nonce`. */
  hashed: string;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Mints a single-use nonce pair. Google receives the SHA-256 hash and stamps it
 * into the ID token; Supabase receives the raw value and re-hashes it to prove
 * the token was minted for this page load. Mirrors the Flutter Apple flow
 * (`sha256.convert(utf8.encode(rawNonce))`), so both clients hash identically.
 */
export async function createNoncePair(): Promise<NoncePair> {
  const raw = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(raw)
  );
  return { raw, hashed: toHex(new Uint8Array(digest)) };
}
