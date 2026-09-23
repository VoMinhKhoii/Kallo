/**
 * The personal-data inventory behind "Export my data".
 *
 * Every Drizzle table in `lib/infra/db/schema.ts` is listed here, keyed by its
 * SQL name, as either
 *   - `{ exported: '<path>' }` — the dotted path in the export document where
 *     its rows appear, or
 *   - `{ excluded: '<reason>' }` — why it is deliberately left out.
 *
 * `__tests__/coverage.test.ts` introspects the schema and fails when a table is
 * missing from this map (a table with a user-linked column most loudly), when
 * an entry names a table that no longer exists, or when an `exported` path is
 * absent from a built export. A new table therefore cannot ship without
 * someone deciding, in review, whether the user gets it back.
 *
 * Outside Postgres-via-Drizzle, the export also covers:
 *   - Supabase Auth: user id, email, sign-up and last sign-in times, the
 *     linked sign-in providers, and the allowlisted profile claims
 *     (`AUTH_CLAIM_KEYS`) of `user_metadata` and each linked identity →
 *     `account`. Sessions, refresh and provider tokens are live credentials
 *     and are never exported; neither is `app_metadata` beyond the providers.
 *   - Storage: the uploaded avatar (`avatars` bucket) and feedback screenshots
 *     (`feedback-screenshots` bucket) → `files`, as bucket + object path. The
 *     bytes are not inlined; the avatar is also visible in the app, and support
 *     can send a screenshot on request.
 */

export type ExportCoverage =
  | { readonly exported: string }
  | { readonly excluded: string };

const REFERENCE_DATA =
  'Shared reference data (food composition, matching vocabulary); holds nothing about any user.';
const ABUSE_CONTROL =
  'Short-lived rate-limit and spend-control state keyed by a keyed hash, not a user id; reaped within days to weeks and holds no content the user supplied.';
const PIPELINE_TRACE =
  "Internal model-debugging trace of one analysis request, reaped with it. The user's own input and profile context for that request are exported under analysis.requests.";

export const EXPORT_COVERAGE: Readonly<Record<string, ExportCoverage>> = {
  // --- Account & profile ---------------------------------------------------
  user_profiles: { exported: 'profile' },
  public_profiles: { exported: 'circleProfile' },

  // --- Food diary ----------------------------------------------------------
  meals: { exported: 'meals' },
  meal_items: { exported: 'meals' },
  body_weight_log: { exported: 'weights' },
  day_completion_marks: { exported: 'dayCompletionMarks' },

  // --- Analysis & app activity ---------------------------------------------
  pipeline_requests: { exported: 'analysis.requests' },
  pending_analyses: { exported: 'analysis.pending' },
  unmatched_ingredients: { exported: 'analysis.unmatchedIngredients' },
  product_telemetry_events: { exported: 'telemetry' },

  // --- Circle --------------------------------------------------------------
  friendships: { exported: 'social.friendships' },
  meal_shares: { exported: 'social.mealShares' },
  meal_share_reactions: { exported: 'social.reactions' },
  meal_share_replies: { exported: 'social.replies' },
  meal_share_invites: { exported: 'social.mealShareInvites' },
  circle_events: { exported: 'social.circleEvents' },
  friends_feed_read_markers: { exported: 'social.feedLastReadAt' },
  coach_assignments: { exported: 'social.coachAssignments' },

  // --- Chat ----------------------------------------------------------------
  chat_groups: { exported: 'chat.groups' },
  chat_group_members: { exported: 'chat.groups' },
  chat_group_messages: { exported: 'chat.messagesSent' },

  // --- Notifications & devices ---------------------------------------------
  notifications: { exported: 'notifications' },
  push_tokens: { exported: 'pushDevices' },

  // --- Support -------------------------------------------------------------
  user_feedback: { exported: 'support.feedback' },

  // --- Billing -------------------------------------------------------------
  entitlement_grants: { exported: 'billingGrants' },
  billing_provider_syncs: { exported: 'billingSyncs' },
  billing_webhook_events: {
    excluded:
      "Raw RevenueCat webhook envelopes kept only for idempotency and retry, pruned by the billing retention job. They are the provider's record of a store event (transaction ids, prices, store metadata, sometimes other aliases) rather than data the user gave us; their effect on the account is exported as billingGrants and billingSyncs. The same table also carries internal account-deletion jobs.",
  },

  // --- Pipeline traces -----------------------------------------------------
  pipeline_stage_logs: { excluded: PIPELINE_TRACE },
  pipeline_llm_calls: { excluded: PIPELINE_TRACE },
  pipeline_llm_call_metadata: { excluded: PIPELINE_TRACE },
  pipeline_runs: {
    excluded:
      'Aggregate pipeline quality metrics keyed by a keyed hash of the user id, never the id or any meal text; counts and timings only.',
  },
  pipeline_shadow_runs: {
    excluded:
      'Offline model comparison keyed by request id, with no user id or hash; used to evaluate prompts, not to serve the user.',
  },
  pipeline_request_replay_audit_logs: {
    excluded:
      "Admin audit trail of who replayed a request (the admin's hashed id), not a record about the user.",
  },
  prompt_versions: { excluded: 'Prompt template registry; no user data.' },

  // --- Abuse and spend controls --------------------------------------------
  analysis_guard_events: { excluded: ABUSE_CONTROL },
  analysis_rate_limit_windows: { excluded: ABUSE_CONTROL },
  analysis_in_flight_limits: { excluded: ABUSE_CONTROL },
  analysis_model_budget_events: {
    excluded: 'Global model spend ledger; no user id or hash.',
  },
  rate_limit_counters: { excluded: ABUSE_CONTROL },
  rate_limit_events: { excluded: ABUSE_CONTROL },

  // --- Reference data ------------------------------------------------------
  ingredient_sources: { excluded: REFERENCE_DATA },
  vietnamese_food_composition: { excluded: REFERENCE_DATA },
  ingredient_query_embeddings: { excluded: REFERENCE_DATA },
  synonym_candidates: { excluded: REFERENCE_DATA },

  // --- Not linked to an account --------------------------------------------
  waitlist_signups: {
    excluded:
      'Pre-launch waitlist keyed by email with no link to an account; a copy is available from support on request.',
  },
};
