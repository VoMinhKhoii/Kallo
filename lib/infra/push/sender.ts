// ---------------------------------------------------------------------------
// Push — sender resolution
// ---------------------------------------------------------------------------
// The whole pipeline is optional infrastructure: a dev machine, CI and every
// test run have no APNs signing key, and none of them should have to fake one.
// With the APNS_* vars unset the pipeline still runs end to end — it loads
// tokens, builds copy, and hands the batch to a sender that drops it — so the
// only thing config buys is the last hop.
//
// Resolved per call rather than memoized: the APNs sender holds no per-instance
// state (the provider-token and HTTP/2 session caches are module-level in
// ./apns.ts), and the send path runs once per notification, not once per
// request.

import 'server-only';
import { createApnsSender } from './apns';
import type { PushSender } from './types';

const noopSender: PushSender = { send: async () => [] };

/** Misconfiguration is a deploy-time fact, not a per-send one: one line in the
 *  log, then silence, instead of a stack trace per notification. */
let reportedBadConfig = false;

/**
 * Never throws. A malformed `APNS_KEY_P8` degrades to the no-op
 * sender exactly as an unset one does — callers run inside `after()` on a
 * request that already succeeded, and a parse error there would surface as an
 * unhandled rejection rather than as a missing push.
 */
export function getPushSender(): PushSender {
  const keyP8 = process.env.APNS_KEY_P8;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const bundleId = process.env.APNS_BUNDLE_ID;
  if (!(keyP8 && keyId && teamId && bundleId)) return noopSender;
  try {
    return createApnsSender({
      keyP8,
      keyId,
      teamId,
      bundleId,
      production: process.env.APNS_PRODUCTION === 'true',
    });
  } catch (error) {
    if (!reportedBadConfig) {
      reportedBadConfig = true;
      console.error('APNS_KEY_P8 is not a usable PKCS#8 EC key', error);
    }
    return noopSender;
  }
}
