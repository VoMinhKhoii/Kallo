import { loadActivityExport } from '@/lib/domain/account-export/activity';
import { loadBillingExport } from '@/lib/domain/account-export/billing';
import { loadChatExport } from '@/lib/domain/account-export/chat';
import { loadMealsExport } from '@/lib/domain/account-export/meals';
import { loadNotificationsExport } from '@/lib/domain/account-export/notifications';
import { loadProfileExport } from '@/lib/domain/account-export/profile';
import { loadSocialExport } from '@/lib/domain/account-export/social';
import { loadSupportExport } from '@/lib/domain/account-export/support';
import { NUTRITION_LABEL_BUCKET } from '@/lib/domain/nutrition/label-images/label-images';
import type { AppDb } from '@/lib/infra/db/client';

/**
 * Bumped when a key is renamed or removed. Adding a key does not bump it: the
 * web download and the mobile share sheet both treat the document as opaque
 * JSON, and version 1 readers keep working because the original six keys are
 * unchanged.
 */
export const DATA_EXPORT_FORMAT_VERSION = 2;

/** A linked sign-in identity, as Supabase Auth's `getUser()` returns it. */
export interface ExportIdentitySource {
  id?: string;
  identity_id?: string;
  provider?: string;
  identity_data?: Record<string, unknown>;
  created_at?: string;
  last_sign_in_at?: string;
  updated_at?: string;
}

/** The Supabase Auth fields the export reports about the account itself. */
export interface ExportAccountSource {
  id: string;
  email?: string | null;
  created_at?: string;
  last_sign_in_at?: string | null;
  app_metadata?: { providers?: unknown };
  user_metadata?: Record<string, unknown>;
  identities?: ExportIdentitySource[];
}

/**
 * The profile claims Supabase Auth stores about the person, in
 * `user_metadata` and each identity's `identity_data`: what they typed at
 * sign-up (`display_name`) and what Google or Apple asserted about them. An
 * allowlist, not a denylist: provider tokens, `app_metadata` and any claim not
 * named here never reach the download, whatever a provider starts sending.
 */
export const AUTH_CLAIM_KEYS = [
  'display_name',
  'full_name',
  'name',
  'given_name',
  'family_name',
  'nickname',
  'preferred_username',
  'avatar_url',
  'picture',
  'email',
  'email_verified',
  'phone_verified',
  'is_private_email',
  'locale',
  'sub',
  'provider_id',
] as const;

export type AuthClaims = Partial<
  Record<(typeof AUTH_CLAIM_KEYS)[number], string | boolean>
>;

function authClaims(source: Record<string, unknown> | undefined): AuthClaims {
  const claims: AuthClaims = {};
  for (const key of AUTH_CLAIM_KEYS) {
    const value = source?.[key];
    if (typeof value === 'string' || typeof value === 'boolean') {
      claims[key] = value;
    }
  }
  return claims;
}

function identitiesOf(user: ExportAccountSource) {
  return (user.identities ?? []).map((identity) => ({
    provider: identity.provider ?? null,
    identityId: identity.identity_id ?? null,
    providerUserId: identity.id ?? null,
    createdAt: identity.created_at ?? null,
    lastSignInAt: identity.last_sign_in_at ?? null,
    updatedAt: identity.updated_at ?? null,
    claims: authClaims(identity.identity_data),
  }));
}

export interface ExportedFile {
  bucket: 'avatars' | 'feedback-screenshots' | typeof NUTRITION_LABEL_BUCKET;
  path: string;
  /** Which record points at the object. */
  source: 'circleProfile' | 'feedback' | 'labelScan';
  sourceId: string | null;
}

function providersOf(user: ExportAccountSource): string[] {
  const providers = user.app_metadata?.providers;
  return Array.isArray(providers)
    ? providers.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

/**
 * Build the complete "Export my data" document for one user.
 *
 * Every area loader scopes its own queries to `user.id` and all of them run in
 * parallel. What each table contributes — or why it is left out — is recorded
 * in `coverage.ts`, which a test holds against the schema.
 */
export async function buildDataExport(db: AppDb, user: ExportAccountSource) {
  const userId = user.id;
  const [profile, diary, social, chat, inbox, support, billing, activity] =
    await Promise.all([
      loadProfileExport(db, userId),
      loadMealsExport(db, userId),
      loadSocialExport(db, userId),
      loadChatExport(db, userId),
      loadNotificationsExport(db, userId),
      loadSupportExport(db, userId),
      loadBillingExport(db, userId),
      loadActivityExport(db, userId),
    ]);

  const files: ExportedFile[] = [];
  if (profile.circleProfile?.avatarPath) {
    files.push({
      bucket: 'avatars',
      path: profile.circleProfile.avatarPath,
      source: 'circleProfile',
      sourceId: null,
    });
  }
  for (const entry of support.feedback) {
    if (entry.screenshotPath) {
      files.push({
        bucket: 'feedback-screenshots',
        path: entry.screenshotPath,
        source: 'feedback',
        sourceId: entry.id,
      });
    }
  }
  for (const scan of diary.labelScans) {
    files.push({
      bucket: NUTRITION_LABEL_BUCKET,
      path: scan.storagePath,
      source: 'labelScan',
      sourceId: scan.id,
    });
  }

  return {
    // The original six keys, unchanged in name and shape.
    exportedAt: new Date().toISOString(),
    account: {
      id: userId,
      email: user.email ?? null,
      createdAt: user.created_at ?? null,
      lastSignInAt: user.last_sign_in_at ?? null,
      signInProviders: providersOf(user),
      // Added in format version 2.
      profileClaims: authClaims(user.user_metadata),
      identities: identitiesOf(user),
    },
    profile: profile.profile,
    meals: diary.meals,
    weights: diary.weights,
    billingGrants: billing.billingGrants,
    // Added in format version 2.
    formatVersion: DATA_EXPORT_FORMAT_VERSION,
    circleProfile: profile.circleProfile,
    dayCompletionMarks: diary.dayCompletionMarks,
    // Photo paths are listed under `files`, like feedback screenshots.
    labelScans: diary.labelScans.map(({ storagePath: _path, ...scan }) => scan),
    social,
    chat,
    notifications: inbox.notifications,
    pushDevices: inbox.pushDevices,
    support,
    billingSyncs: billing.billingSyncs,
    analysis: activity.analysis,
    telemetry: activity.telemetry,
    files,
  };
}

export type DataExport = Awaited<ReturnType<typeof buildDataExport>>;
