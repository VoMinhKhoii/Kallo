// ---------------------------------------------------------------------------
// Friendship — canonical pair ordering
// ---------------------------------------------------------------------------
// Pure, dependency-light helper (no DB imports) so it is safe to vendor-copy
// into the mobile package. A friendship is symmetric, so we store exactly one
// row per pair with the two user ids in a canonical order: user_low < user_high
// (string comparison of the uuids). This structurally forbids duplicate or
// asymmetric rows and matches the `friendships_user_order_check` DB constraint.

export interface OrderedPair {
  userLow: string;
  userHigh: string;
}

/**
 * Order two user ids into the canonical `{ userLow, userHigh }` shape where
 * `userLow < userHigh` (lexicographic). Commutative: `orderedPair(a, b)` and
 * `orderedPair(b, a)` return the same result.
 */
export function orderedPair(a: string, b: string): OrderedPair {
  if (a === b) {
    throw new Error('orderedPair: a and b must be different users.');
  }
  return a < b ? { userLow: a, userHigh: b } : { userLow: b, userHigh: a };
}
