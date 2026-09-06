// ---------------------------------------------------------------------------
// Push — APNs HTTP/2 sender (no new dependencies)
// ---------------------------------------------------------------------------
// iOS is the only client we ship, so we talk to Apple directly instead of
// paying for Firebase as a relay: a provider JWT signed with the .p8 key
// (ES256 via node:crypto) plus one long-lived HTTP/2 session held open across
// sends. Both caches are module-level — the sender is resolved per call and
// holds no per-instance state.
//
// Two details Apple is unforgiving about, and both are silent in type-land:
// the signature must be IEEE-P1363 (Node's DER default is rejected), and the
// token must be refreshed no more often than every 20 minutes and no less
// often than every 60. We sit at 40.

import 'server-only';
import {
  createPrivateKey,
  type KeyObject,
  sign as signWith,
} from 'node:crypto';
import { type ClientHttp2Session, connect } from 'node:http2';
import type { PushMessage, PushSender, PushSendResult } from './types';

export interface ApnsConfig {
  /** Contents of the AuthKey_XXXX.p8 file; escaped \n are normalized. */
  keyP8: string;
  keyId: string;
  teamId: string;
  bundleId: string;
  /** true → api.push.apple.com; false → the sandbox host. Must match the
   *  build the device token came from, or every send 400s BadDeviceToken. */
  production: boolean;
}

const PROD_HOST = 'https://api.push.apple.com';
const SANDBOX_HOST = 'https://api.sandbox.push.apple.com';
/** Apple rejects refreshes more often than 20 min and tokens older than 60. */
const TOKEN_TTL_MS = 40 * 60 * 1000;
/** A hung stream must not stall the whole batch behind it. */
const REQUEST_TIMEOUT_MS = 10_000;
/** apns-collapse-id is capped at 64 bytes by Apple; ours are far shorter. */
const COLLAPSE_ID_MAX_BYTES = 64;

let cachedToken: { jwt: string; keyId: string; issuedAt: number } | null = null;
let cachedSession: { session: ClientHttp2Session; host: string } | null = null;

/** Test seam: both caches are process-global. */
export function resetApnsState(): void {
  cachedToken = null;
  cachedSession?.session.close();
  cachedSession = null;
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** The provider token: `{alg,kid}.{iss,iat}` signed P-256, P1363-encoded. */
function providerToken(config: ApnsConfig, key: KeyObject): string {
  const now = Date.now();
  if (
    cachedToken &&
    cachedToken.keyId === config.keyId &&
    now - cachedToken.issuedAt < TOKEN_TTL_MS
  ) {
    return cachedToken.jwt;
  }
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: config.keyId }));
  const claims = base64url(
    JSON.stringify({ iss: config.teamId, iat: Math.floor(now / 1000) })
  );
  const signature = signWith('sha256', Buffer.from(`${header}.${claims}`), {
    key,
    // MANDATORY: Node defaults to DER, which APNs rejects outright.
    dsaEncoding: 'ieee-p1363',
  });
  const jwt = `${header}.${claims}.${base64url(signature)}`;
  cachedToken = { jwt, keyId: config.keyId, issuedAt: now };
  return jwt;
}

/** One session per process, reconnected the moment Apple drops it. */
function getSession(host: string): ClientHttp2Session {
  const live = cachedSession;
  if (
    live &&
    live.host === host &&
    !live.session.destroyed &&
    !live.session.closed
  ) {
    return live.session;
  }
  const session = connect(host);
  // An idle push session must never hold the process open.
  session.unref();
  const drop = () => {
    if (cachedSession?.session === session) cachedSession = null;
  };
  session.on('close', drop);
  session.on('goaway', drop);
  session.on('error', drop);
  cachedSession = { session, host };
  return session;
}

/**
 * Which failures mean "delete this registration"?
 *
 * Only 410 `Unregistered` (the app is gone from the device) and 400
 * `DeviceTokenNotForTopic` (the token belongs to a different bundle id, so it
 * can never be ours). Notably NOT `BadDeviceToken`: Apple returns it just as
 * readily for a perfectly valid token sent to the wrong host as for a garbage
 * one, so pruning on it would silently wipe every registration the first time
 * APNS_PRODUCTION disagreed with the build. Deleting a live registration is
 * far worse than retrying a dead one — everything else keeps the row.
 */
export function classifyApnsFailure(status: number, reason: string): boolean {
  if (status === 410 || reason === 'Unregistered') return true;
  return status === 400 && reason === 'DeviceTokenNotForTopic';
}

function buildHeaders(
  message: PushMessage,
  config: ApnsConfig,
  jwt: string
): Record<string, string> {
  const headers: Record<string, string> = {
    ':method': 'POST',
    ':path': `/3/device/${message.token}`,
    authorization: `bearer ${jwt}`,
    'apns-topic': config.bundleId,
    'apns-push-type': 'alert',
    'apns-priority': '10',
    'apns-expiration': '0',
  };
  if (message.collapseKey) {
    headers['apns-collapse-id'] = Buffer.from(message.collapseKey)
      .subarray(0, COLLAPSE_ID_MAX_BYTES)
      .toString();
  }
  return headers;
}

/** The native aps dict — the client reads `alert`, the rest is our data map. */
export function buildApnsPayload(message: PushMessage): string {
  return JSON.stringify({
    aps: {
      alert: { title: message.title, body: message.body },
      sound: 'default',
      ...(message.badge !== undefined && { badge: message.badge }),
    },
    ...message.data,
  });
}

function sendOne(
  message: PushMessage,
  config: ApnsConfig,
  jwt: string
): Promise<PushSendResult> {
  return new Promise((resolve, reject) => {
    const session = getSession(config.production ? PROD_HOST : SANDBOX_HOST);
    const stream = session.request(buildHeaders(message, config, jwt));
    let status = 0;
    const chunks: Buffer[] = [];

    stream.setTimeout(REQUEST_TIMEOUT_MS, () => {
      stream.destroy(new Error('APNs request timed out'));
    });
    stream.on('response', (headers) => {
      status = Number(headers[':status'] ?? 0);
    });
    stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => {
      if (status >= 200 && status < 300) {
        resolve({ token: message.token, ok: true, shouldPrune: false });
        return;
      }
      const body = Buffer.concat(chunks).toString('utf8');
      let reason = '';
      try {
        reason = (JSON.parse(body) as { reason?: string }).reason ?? '';
      } catch {
        reason = '';
      }
      if (reason === 'BadDeviceToken') {
        console.error(
          `APNs BadDeviceToken for a ${config.production ? 'production' : 'sandbox'} send — likely an APNS_PRODUCTION mismatch with the build this token came from. Keeping the registration.`
        );
      } else {
        console.error(`APNs send failed (${status}) ${reason}`);
      }
      resolve({
        token: message.token,
        ok: false,
        shouldPrune: classifyApnsFailure(status, reason),
      });
    });
    stream.end(buildApnsPayload(message));
  });
}

/** The real sender. `sendNotificationPush` never lets its rejections escape. */
export function createApnsSender(config: ApnsConfig): PushSender {
  // Parsed ONCE, eagerly: a malformed .p8 must surface here, where
  // getPushSender() catches it and degrades to the no-op — not on every send.
  // Literal \n survive single-line env vars; PEM parsing needs real newlines.
  const key = createPrivateKey(config.keyP8.replace(/\\n/g, '\n'));
  return {
    async send(messages: PushMessage[]): Promise<PushSendResult[]> {
      if (messages.length === 0) return [];
      const jwt = providerToken(config, key);
      const settled = await Promise.allSettled(
        messages.map((message) => sendOne(message, config, jwt))
      );
      // Exactly one result per input message, whatever happened to the stream.
      return settled.map((outcome, index) =>
        outcome.status === 'fulfilled'
          ? outcome.value
          : { token: messages[index].token, ok: false, shouldPrune: false }
      );
    },
  };
}
