/**
 * Whether the copy/split meal feature is switched on.
 *
 * Set to `false` while the feature is paused. It turns off all four moving
 * parts at once: offering a meal to friends (`shareMealWithFriendsAction`),
 * copying a friend's meal off the wall (`logSharedMealAction`), responding to
 * an offer (`acceptMealShareInviteAction` / `dismissMealShareInviteAction`),
 * and the pending-invites list — which is emptied at its source so the nav's
 * attention dot cannot keep pointing at a surface that is no longer there.
 * Every UI entry point is hidden behind the same constant, and the actions
 * still refuse on their own so an old mobile build (or a hand-rolled request)
 * gets a 409 rather than a silent write.
 *
 * Why paused: the entitlement semantics are unresolved. A split rescales the
 * SENDER's meal at send time, so gating the recipient's accept would strand a
 * premium sender's already-halved meal in a friend's inbox forever. Rather
 * than ship a gate that can lose someone's food, the feature comes off until
 * the send/accept split is decided.
 *
 * Nothing is deleted: the tables and their rows stay, the `copy_split` key
 * stays in the FEATURES catalog, and the per-action premium gates stay in
 * place behind this refusal. Turning the feature back on is one edit here.
 */
export const COPY_SPLIT_LIVE = false;

/** The refusal shown when an action is reached while the feature is paused. */
export const COPY_SPLIT_PAUSED_MESSAGE =
  'Tính năng chia sẻ và chia phần bữa ăn đang tạm dừng.';
