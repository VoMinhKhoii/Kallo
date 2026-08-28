// ---------------------------------------------------------------------------
// Push — sender resolution
// ---------------------------------------------------------------------------
// The whole pipeline is optional infrastructure: a dev machine, CI and every
// test run have no Firebase project, and none of them should have to fake one.
// With FCM_SERVICE_ACCOUNT_JSON unset the pipeline still runs end to end — it
// loads tokens, builds copy, and hands the batch to a sender that drops it —
// so the only thing config buys is the last hop.
//
// Resolved per call rather than memoized: the FCM sender holds no per-instance
// state (the access token cache is module-level in ./fcm.ts), and the send
// path runs once per notification, not once per request.

import 'server-only';
import { createFcmSender } from './fcm';
import type { PushSender } from './types';

const noopSender: PushSender = { send: async () => [] };

/** Misconfiguration is a deploy-time fact, not a per-send one: one line in the
 *  log, then silence, instead of a stack trace per notification. */
let reportedBadConfig = false;

/**
 * Never throws. A malformed `FCM_SERVICE_ACCOUNT_JSON` degrades to the no-op
 * sender exactly as an unset one does — callers run inside `after()` on a
 * request that already succeeded, and a parse error there would surface as an
 * unhandled rejection rather than as a missing push.
 */
export function getPushSender(): PushSender {
  const serviceAccount = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!serviceAccount) return noopSender;
  try {
    return createFcmSender(serviceAccount);
  } catch (error) {
    if (!reportedBadConfig) {
      reportedBadConfig = true;
      console.error('FCM_SERVICE_ACCOUNT_JSON is not valid JSON', error);
    }
    return noopSender;
  }
}
