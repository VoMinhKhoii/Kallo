// ---------------------------------------------------------------------------
// Push — the transport boundary
// ---------------------------------------------------------------------------
// Everything above this seam (lib/domain/notifications/push.ts) speaks in
// already-localized title/body plus a flat string map, and knows nothing about
// APNs, JWTs or HTTP/2. Everything below it is one swappable implementation:
// the APNs sender in ./apns.ts, the no-op used whenever the signing key is
// unset, or a vi.fn() double in tests.
//
// Deliberately not isomorphic with the APNs wire shape: `collapseKey`,
// `badge` and `sender` are intents ("supersede the earlier notice about this
// thing", "the app icon should read N", "this came from a person — show them"),
// and the sender decides how to express them.

/** The person a push is from. On iOS it becomes a communication
 *  notification: their avatar in place of the app icon, the app's own icon
 *  badged in the corner. */
export interface PushSenderIdentity {
  id: string;
  name: string;
  /** Public https URL of their photo; absent → the device draws initials. */
  avatarUrl?: string;
  /** What picks their initials-disc tint (avatar seed, else handle) — the
   *  same key the in-app disc hashes, so the fallback matches the app. */
  tintKey?: string;
}

export interface PushMessage {
  /** The APNs device token this goes to. */
  token: string;
  title: string;
  body: string;
  /** Deep-link payload, merged alongside `aps`. Flat strings only. */
  data: Record<string, string>;
  /** Supersedes an undelivered notification carrying the same key, so ten
   *  reactions on one meal never stack ten notices in the shade. */
  collapseKey?: string;
  /** App icon count (iOS). Omitted leaves the current badge alone. */
  badge?: number;
  /** Who did it. Omitted renders a plain app notification. */
  sender?: PushSenderIdentity;
  /** Which conversation this belongs to (a chat group, or the person for
   *  activity). iOS uses it to thread the sender's notices together. */
  conversationId?: string;
}

export interface PushSendResult {
  token: string;
  ok: boolean;
  /** The token is permanently invalid (app deleted, token reassigned) and the
   *  caller must delete its row. Transient failures never set this — losing a
   *  push is acceptable, losing the registration is not. */
  shouldPrune: boolean;
}

export interface PushSender {
  send(messages: PushMessage[]): Promise<PushSendResult[]>;
}
