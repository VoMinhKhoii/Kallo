import { connection } from 'next/server';
import type { AuthTab } from '@/components/auth/auth-provider';
import { googleWebClientId } from '@/lib/infra/auth/google-client-id';
import { safeNextPath } from '@/lib/infra/auth/safe-next';
import { ApplyAuthRequestConfig } from './apply-auth-request-config';

export interface AuthSearchParams {
  auth?: string;
  next?: string;
}

/**
 * The auth dialog's request-time inputs, for a page whose shell is prerendered.
 *
 * `GOOGLE_WEB_CLIENT_ID` is deliberately a runtime env var (see
 * `lib/infra/auth/google-client-id.ts`), and a prerendered page would bake in
 * whatever the BUILD saw — nothing, in the Docker build. `connection()` defers
 * the read to the request. On the landing page the `?auth=` / `?next=` intent
 * (from an invite link) comes along the same way.
 *
 * Render it inside `<Suspense fallback={null}>` under the `AuthProvider`: the
 * page paints from the static shell, and this applies its values a moment
 * later — before anyone can reach the dialog's Google button.
 */
export async function AuthRequestConfig({
  searchParams,
}: {
  searchParams?: Promise<AuthSearchParams>;
}) {
  await connection();
  const googleClientId = googleWebClientId();

  if (!searchParams) {
    return <ApplyAuthRequestConfig googleClientId={googleClientId} />;
  }

  const intent = authIntent(await searchParams);
  return (
    <ApplyAuthRequestConfig
      googleClientId={googleClientId}
      next={intent.next}
      openTab={intent.openTab}
    />
  );
}

/**
 * Open the dialog when arriving from an invite link (`?auth=…&next=…`),
 * defaulting to the sign-up tab: invite recipients usually have no account.
 */
export function authIntent({ auth, next: rawNext }: AuthSearchParams): {
  next: string | null;
  openTab: AuthTab | null;
} {
  const next = safeNextPath(rawNext);
  const open = auth === 'sign-in' || auth === 'sign-up' || next !== null;
  return {
    next,
    openTab: open ? (auth === 'sign-in' ? 'sign-in' : 'sign-up') : null,
  };
}
