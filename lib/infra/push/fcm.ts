// ---------------------------------------------------------------------------
// Push — FCM HTTP v1 sender (no new dependencies)
// ---------------------------------------------------------------------------
// firebase-admin would pull a large transitive tree in for what is, at this
// scale, two HTTP calls: mint a service-account access token, then POST one
// message per device. So we do it by hand — a self-signed JWT (RS256 via
// node:crypto) exchanged for an OAuth2 access token, cached for just under its
// hour of life, and reused across every send in the process.
//
// The wire shape is unforgiving: FCM rejects unknown *and* null fields, so the
// apns/android blocks are built conditionally rather than emitted with
// undefined members. Failures are classified into "drop this token" versus
// "we'll try again next time" — see classifyFailure.

import 'server-only';
import { createSign } from 'node:crypto';
import type { PushMessage, PushSender, PushSendResult } from './types';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const JWT_BEARER = 'urn:ietf:params:oauth:grant-type:jwt-bearer';
/** Access tokens live an hour; refresh at 55 minutes so an in-flight batch
 *  never straddles the expiry. */
const TOKEN_TTL_MS = 55 * 60 * 1000;
/** Sends per Promise.allSettled wave — small enough not to open a hundred
 *  sockets at once, large enough that a 50-member group chat is one round. */
const CHUNK = 10;

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

let cached: { token: string; expiresAt: number } | null = null;

/** Test seam: the module-level access-token cache is process-global. */
export function resetFcmTokenCache(): void {
  cached = null;
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** A service-account assertion: header.claims signed with the account's key. */
function signAssertion(account: ServiceAccount, nowSeconds: number): string {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    })
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  signer.end();
  // Literal \n survive JSON env vars; PEM parsing needs real newlines.
  const key = account.private_key.replace(/\\n/g, '\n');
  return `${header}.${claims}.${base64url(signer.sign(key))}`;
}

async function getAccessToken(account: ServiceAccount): Promise<string> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.token;

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: JWT_BEARER,
      assertion: signAssertion(account, Math.floor(now / 1000)),
    }).toString(),
  });
  if (!response.ok) {
    throw new Error(`FCM token exchange failed (${response.status})`);
  }
  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error('FCM token exchange returned no token');
  }
  cached = { token: json.access_token, expiresAt: now + TOKEN_TTL_MS };
  return json.access_token;
}

/** The `message` object, with the platform blocks present only when they
 *  carry something — FCM 400s on a null collapse_key or badge. */
export function buildFcmMessage(message: PushMessage): Record<string, unknown> {
  const apnsPayload: Record<string, unknown> = {};
  if (message.badge !== undefined) apnsPayload.aps = { badge: message.badge };
  const apnsHeaders: Record<string, string> = {};
  if (message.collapseKey) {
    apnsHeaders['apns-collapse-id'] = message.collapseKey;
  }

  const apns: Record<string, unknown> = {};
  if (Object.keys(apnsHeaders).length > 0) apns.headers = apnsHeaders;
  if (Object.keys(apnsPayload).length > 0) apns.payload = apnsPayload;

  const built: Record<string, unknown> = {
    token: message.token,
    notification: { title: message.title, body: message.body },
    data: message.data,
  };
  if (Object.keys(apns).length > 0) built.apns = apns;
  if (message.collapseKey) {
    built.android = { collapse_key: message.collapseKey };
  }
  return built;
}

/**
 * Is this failure the token's fault, or the moment's? UNREGISTERED (404) is
 * the canonical "app was deleted / token rotated"; INVALID_ARGUMENT (400) on a
 * send means the registration string itself is malformed — neither will ever
 * succeed, so both prune. 401/403/429/5xx are ours or transient: keep the row.
 */
export function classifyFailure(status: number, body: unknown): boolean {
  const error = (body as { error?: { status?: string; details?: unknown[] } })
    ?.error;
  const errorCode = (error?.details ?? []).reduce<string | undefined>(
    (found, detail) =>
      found ?? (detail as { errorCode?: string } | null)?.errorCode,
    undefined
  );
  if (status === 404 || errorCode === 'UNREGISTERED') return true;
  return (
    status === 400 &&
    (errorCode === 'INVALID_ARGUMENT' || error?.status === 'INVALID_ARGUMENT')
  );
}

async function sendOne(
  message: PushMessage,
  projectId: string,
  accessToken: string
): Promise<PushSendResult> {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ message: buildFcmMessage(message) }),
    }
  );
  if (response.ok) {
    return { token: message.token, ok: true, shouldPrune: false };
  }
  const body = await response.json().catch(() => null);
  return {
    token: message.token,
    ok: false,
    shouldPrune: classifyFailure(response.status, body),
  };
}

/** The real sender. `sendNotificationPush` never lets its rejections escape. */
export function createFcmSender(serviceAccountJson: string): PushSender {
  const account = JSON.parse(serviceAccountJson) as ServiceAccount;
  return {
    async send(messages: PushMessage[]): Promise<PushSendResult[]> {
      if (messages.length === 0) return [];
      const accessToken = await getAccessToken(account);
      const results: PushSendResult[] = [];
      for (let i = 0; i < messages.length; i += CHUNK) {
        const wave = await Promise.allSettled(
          messages
            .slice(i, i + CHUNK)
            .map((message) => sendOne(message, account.project_id, accessToken))
        );
        for (const [index, settled] of wave.entries()) {
          results.push(
            settled.status === 'fulfilled'
              ? settled.value
              : {
                  token: messages[i + index].token,
                  ok: false,
                  shouldPrune: false,
                }
          );
        }
      }
      return results;
    },
  };
}
