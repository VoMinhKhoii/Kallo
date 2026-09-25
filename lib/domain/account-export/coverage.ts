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
 *   - Storage: the uploaded avatar (`avatars` bucket), feedback screenshots
 *     (`feedback-screenshots` bucket) and kept nutrition-label scan photos
 *     (`nutrition-labels` bucket) → `files`, as bucket + object path. The
 *     bytes are not inlined; the avatar is also visible in the app, and support
 *     can send a screenshot or label photo on request.
 */

export type ExportCoverage =
  | {
      readonly exported: string;
      /**
       * Columns of an exported table that do NOT reach the document, by SQL
       * name, each with the reason. `__tests__/column-coverage.test.ts`
       * perturbs every column in turn and fails on one that changes nothing
       * in the export yet is not listed here — so a column added later ships
       * in the export or is excluded on purpose, never dropped by accident.
       */
      readonly excludedColumns?: Readonly<Record<string, string>>;
    }
  | { readonly excluded: string };

const REFERENCE_DATA =
  'Shared reference data (food composition, matching vocabulary); holds nothing about any user.';
const ABUSE_CONTROL =
  'Short-lived rate-limit and spend-control state keyed by a keyed hash, not a user id; reaped within days to weeks and holds no content the user supplied.';
const OWN_ID =
  "The caller's own user id, the key every query filters by; the whole file is about them and it is exported once as account.id.";
const FRIEND_PAIR =
  "One side of the ordered friend pair (user_low < user_high). The friend's side is exported as friendUserId, picked in SQL so the column test cannot trace it; the other side is the caller's own id.";
const PIPELINE_TRACE =
  "Internal model-debugging trace of one analysis request, reaped with it. The user's own input and profile context for that request are exported under analysis.requests.";

export const EXPORT_COVERAGE: Readonly<Record<string, ExportCoverage>> = {
  // --- Account & profile ---------------------------------------------------
  user_profiles: { exported: 'profile' },
  public_profiles: {
    exported: 'circleProfile',
    excludedColumns: { user_id: OWN_ID },
  },

  // --- Food diary ----------------------------------------------------------
  meals: { exported: 'meals' },
  meal_items: { exported: 'meals' },
  body_weight_log: { exported: 'weights' },
  day_completion_marks: {
    exported: 'dayCompletionMarks',
    excludedColumns: { user_id: OWN_ID },
  },
  nutrition_label_images: {
    exported: 'labelScans',
    excludedColumns: {
      user_id: OWN_ID,
      model:
        'Internal diagnostics of the scan call: which model version answered. The scan itself, its result and the photo location are exported.',
      latency_ms:
        'Internal diagnostics of the scan call: how long the model took to answer.',
    },
  },

  // --- Analysis & app activity ---------------------------------------------
  pipeline_requests: {
    exported: 'analysis.requests',
    excludedColumns: {
      user_id: OWN_ID,
      error:
        'Internal failure diagnostics (exception text from the model pipeline), not information about the user; the outcome is exported as status.',
      prompt_versions_used:
        'Ids of the internal prompt templates that served the request.',
      replay_of_request_id:
        'Set only on an admin replay of a request, linking it to the original.',
      dry_run:
        'Internal flag for evaluation runs, which never serve or store a meal.',
    },
  },
  pending_analyses: {
    exported: 'analysis.pending',
    excludedColumns: {
      user_id: OWN_ID,
      attempt_id:
        "Random idempotency key the client generates so a retried save isn't stored twice; carries no information.",
    },
  },
  unmatched_ingredients: {
    exported: 'analysis.unmatchedIngredients',
    excludedColumns: { user_id: OWN_ID },
  },
  product_telemetry_events: {
    exported: 'telemetry',
    excludedColumns: {
      user_id: OWN_ID,
      id: 'Surrogate row key; each event is identified by its exported eventId.',
      schema_version: 'Event-format version, the same constant on every row.',
    },
  },

  // --- Circle --------------------------------------------------------------
  friendships: {
    exported: 'social.friendships',
    excludedColumns: {
      user_low: FRIEND_PAIR,
      user_high: FRIEND_PAIR,
    },
  },
  meal_shares: {
    exported: 'social.mealShares',
    excludedColumns: { actor_id: OWN_ID },
  },
  meal_share_reactions: {
    exported: 'social.reactions',
    excludedColumns: { user_id: OWN_ID },
  },
  meal_share_replies: {
    exported: 'social.replies',
    excludedColumns: { user_id: OWN_ID },
  },
  meal_share_invites: { exported: 'social.mealShareInvites' },
  circle_events: {
    exported: 'social.circleEvents',
    excludedColumns: { actor_id: OWN_ID },
  },
  friends_feed_read_markers: {
    exported: 'social.feedLastReadAt',
    excludedColumns: { user_id: OWN_ID },
  },
  coach_assignments: {
    exported: 'social.coachAssignments',
    excludedColumns: {
      audience_id:
        'Reserved cohort seam for a future coach console; nothing writes it, so it is always null.',
    },
  },

  // --- Chat ----------------------------------------------------------------
  chat_groups: {
    exported: 'chat.groups',
    excludedColumns: {
      direct_user_low:
        "A 1:1 chat's ordered member pair, kept for uniqueness; both people are exported in memberUserIds.",
      direct_user_high:
        "A 1:1 chat's ordered member pair, kept for uniqueness; both people are exported in memberUserIds.",
    },
  },
  chat_group_members: {
    exported: 'chat.groups',
    excludedColumns: {
      id: 'Surrogate row key of a membership; the membership is exported as the group entry with myRole and joinedAt.',
    },
  },
  chat_group_messages: {
    exported: 'chat.messagesSent',
    excludedColumns: { sender_id: OWN_ID },
  },

  // --- Notifications & devices ---------------------------------------------
  notifications: {
    exported: 'notifications',
    excludedColumns: {
      recipient_id: OWN_ID,
      group_key:
        'Internal key that folds repeat activity into one row; the grouped actors and target are exported.',
      rebadged:
        'Transient flag for the push sender, meaningful only inside the statement that sets it.',
    },
  },
  push_tokens: {
    exported: 'pushDevices',
    excludedColumns: { user_id: OWN_ID },
  },

  // --- Support -------------------------------------------------------------
  user_feedback: {
    exported: 'support.feedback',
    excludedColumns: { user_id: OWN_ID },
  },

  // --- Billing -------------------------------------------------------------
  entitlement_grants: { exported: 'billingGrants' },
  billing_provider_syncs: {
    exported: 'billingSyncs',
    excludedColumns: {
      user_id: OWN_ID,
      ownership_event_id:
        'Internal ordering watermark: the id of the provider event that last set ownership, used to ignore out-of-order webhooks.',
      ownership_event_priority:
        'Internal ordering watermark paired with ownership_event_id.',
    },
  },
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
