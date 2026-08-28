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

export function getPushSender(): PushSender {
  const serviceAccount = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!serviceAccount) return noopSender;
  return createFcmSender(serviceAccount);
}
