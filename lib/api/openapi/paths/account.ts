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
        'Meal descriptions and nutrition-label photos are sent to Google Gemini (Vertex AI) to estimate nutrition. `consented: true` records the consent (now); `false` withdraws it. While no consent is recorded, `POST /api/analyze-meal` and `POST /api/v1/nutrition-label/scan` answer 403 `ai_consent_required`, and ingredient search skips live embedding calls.',
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
