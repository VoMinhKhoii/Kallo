import { loadActivityExport } from '@/lib/domain/account-export/activity';
import { loadBillingExport } from '@/lib/domain/account-export/billing';
import { loadChatExport } from '@/lib/domain/account-export/chat';
import { loadMealsExport } from '@/lib/domain/account-export/meals';
import { loadNotificationsExport } from '@/lib/domain/account-export/notifications';
import { loadProfileExport } from '@/lib/domain/account-export/profile';
import { loadSocialExport } from '@/lib/domain/account-export/social';
import { loadSupportExport } from '@/lib/domain/account-export/support';
import type { AppDb } from '@/lib/infra/db/client';

/**
 * Bumped when a key is renamed or removed. Adding a key does not bump it: the
 * web download and the mobile share sheet both treat the document as opaque
 * JSON, and version 1 readers keep working because the original six keys are
 * unchanged.
 */
export const DATA_EXPORT_FORMAT_VERSION = 2;

/** The Supabase Auth fields the export reports about the account itself. */
export interface ExportAccountSource {
  id: string;
  email?: string | null;
  created_at?: string;
  last_sign_in_at?: string | null;
  app_metadata?: { providers?: unknown };
}

export interface ExportedFile {
  bucket: 'avatars' | 'feedback-screenshots';
  path: string;
  /** Which record points at the object. */
  source: 'circleProfile' | 'feedback';
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

  return {
    // The original six keys, unchanged in name and shape.
    exportedAt: new Date().toISOString(),
    account: {
      id: userId,
      email: user.email ?? null,
      createdAt: user.created_at ?? null,
      lastSignInAt: user.last_sign_in_at ?? null,
      signInProviders: providersOf(user),
    },
    profile: profile.profile,
    meals: diary.meals,
    weights: diary.weights,
    billingGrants: billing.billingGrants,
    // Added in format version 2.
    formatVersion: DATA_EXPORT_FORMAT_VERSION,
    circleProfile: profile.circleProfile,
    dayCompletionMarks: diary.dayCompletionMarks,
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
