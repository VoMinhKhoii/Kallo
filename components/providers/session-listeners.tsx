'use client';

import dynamic from 'next/dynamic';

const TelemetryIdentity = dynamic(
  () => import('./telemetry-identity').then((m) => m.TelemetryIdentity),
  { ssr: false }
);

const ComposerDraftSession = dynamic(
  () => import('./composer-draft-session').then((m) => m.ComposerDraftSession),
  { ssr: false }
);

/**
 * The two listeners that follow the auth session. Neither renders anything, so
 * they load after the page has become interactive instead of holding it back
 * with the Supabase client and Sentry on a slow connection.
 */
export function SessionListeners() {
  return (
    <>
      <TelemetryIdentity />
      <ComposerDraftSession />
    </>
  );
}
