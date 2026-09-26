import {
  aiConsentSchema,
  profileSettingsSchema,
  sharingPreferencesSchema,
} from '@/lib/api/contracts/onboarding';
import {
  authed,
  fromZod,
  PAYLOAD_TOO_LARGE_ERROR,
  type PathItem,
  ref,
} from '@/lib/api/openapi/components';
import { appleTokenLinkBodySchema } from '@/lib/domain/apple-sign-in/contracts';

const TAGS = ['Account'];

/** Identity, entitlements, export and deletion. */
export const ACCOUNT_PATHS: Record<string, PathItem> = {
  '/api/v1/account': {
    get: authed({
      operationId: 'exportAccount',
      summary: 'Export everything stored about the caller',
      description:
        'The self-service data export: account and sign-in metadata, profile and Circle profile, meals with their items, weights, day marks, friendships, shares, reactions and replies you wrote, share invites, chats you are in and the messages you sent, notifications, registered push devices (token redacted), feedback, billing grants and sync state, recent analysis requests, and product telemetry. Uploaded files are listed by Storage path, not inlined. This is the machine-readable half of the right of access and data portability described in the privacy policy.',
      tags: TAGS,
      ok: ref('DataExport'),
      okDescription: 'The complete export document.',
    }),
    delete: authed({
      operationId: 'deleteAccount',
      summary: 'Delete the account',
      description:
        'Schedules deletion of the account and everything under it. Irreversible once it runs; an hourly job completes any that fail on the first attempt.',
      tags: TAGS,
      ok: ref('Acknowledgement'),
    }),
  },

  '/api/v1/auth/apple/token': {
    post: authed({
      operationId: 'linkAppleToken',
      summary: 'Hand over a Sign in with Apple authorization code',
      description:
        'Call right after a native Sign in with Apple, with the `authorizationCode` from the credential. The server exchanges it with Apple for a refresh token and keeps it encrypted, solely so that deleting the account revokes the Apple authorization. The code must belong to the caller’s own linked Apple identity (409 `CONFLICT` otherwise, or when the account has no Apple identity); an expired or reused code is a 400 `VALIDATION_FAILED`. `stored: false` means this deployment has no Apple credentials configured. Fire-and-forget: a client must never block or fail sign-in on this call.',
      tags: TAGS,
      body: fromZod(appleTokenLinkBodySchema),
      ok: {
        type: 'object',
        properties: { stored: { type: 'boolean' } },
        required: ['stored'],
      },
      extraErrors: {
        ...PAYLOAD_TOO_LARGE_ERROR,
        '409': {
          description:
            'The code belongs to a different Apple identity, or the account has none (`CONFLICT`).',
          content: { 'application/json': { schema: ref('Error') } },
        },
      },
    }),
  },

  '/api/v1/account/entitlements': {
    get: authed({
      operationId: 'getEntitlements',
      summary: 'Which paid features the caller has',
      description:
        'The current entitlement state and where it came from. Read this rather than inferring a plan from a purchase receipt.',
      tags: [...TAGS, 'Billing'],
      ok: ref('Entitlements'),
    }),
  },

  '/api/v1/account/entitlements/reconcile': {
    post: authed({
      operationId: 'reconcileEntitlements',
      summary: 'Re-sync entitlements with the billing provider',
      description:
        'Forces a refresh against the billing provider. For the case where a webhook was missed and the stored state has fallen behind a purchase the user already made.',
      tags: [...TAGS, 'Billing'],
      ok: ref('Entitlements'),
    }),
  },

  '/api/v1/account/billing-config': {
    get: authed({
      operationId: 'getBillingConfig',
      summary: 'Client billing configuration',
      description:
        'The publishable keys and product identifiers a client needs to open checkout. Contains no secrets.',
      tags: [...TAGS, 'Billing'],
      ok: ref('Acknowledgement'),
    }),
  },

  '/api/v1/profile': {
    put: authed({
      operationId: 'updateProfile',
      summary: 'Update body metrics and goal',
      description:
        'Height, weight, activity, goal, region and cooking habits. These are the inputs every calorie and macro target is derived from, so a change here re-derives the numbers the app shows.',
      tags: TAGS,
      extraErrors: PAYLOAD_TOO_LARGE_ERROR,
      body: fromZod(profileSettingsSchema),
      ok: ref('OnboardingProfile'),
    }),
  },

  '/api/v1/profile/sharing': {
    put: authed({
      operationId: 'updateSharingPreference',
      summary: 'Set whether new meals auto-share to your circle',
      description:
        'Controls the default visibility of newly logged meals. Existing meals keep the visibility they were saved with.',
      tags: [...TAGS, 'Circle'],
      extraErrors: PAYLOAD_TOO_LARGE_ERROR,
      body: fromZod(sharingPreferencesSchema),
      ok: ref('Acknowledgement'),
    }),
  },

  '/api/v1/profile/ai-consent': {
    put: authed({
      operationId: 'updateAiProcessingConsent',
      summary: 'Grant or withdraw consent to third-party AI processing',
      description:
        'Meal descriptions, nutrition-label photos and ingredient search text are sent to Google Gemini (Vertex AI) to estimate nutrition. `consented: true` records the consent (now); `false` withdraws it. While no consent is recorded, `POST /api/analyze-meal` and `POST /api/v1/nutrition-label/scan` answer 403 `ai_consent_required`, and ingredient search skips live embedding calls.',
      tags: TAGS,
      extraErrors: PAYLOAD_TOO_LARGE_ERROR,
      body: fromZod(aiConsentSchema),
      ok: {
        type: 'object',
        additionalProperties: false,
        required: ['aiProcessingConsentedAt'],
        properties: {
          aiProcessingConsentedAt: {
            type: ['string', 'null'],
            format: 'date-time',
            description: 'When consent was recorded; null after a withdrawal.',
          },
        },
      },
    }),
  },
};
