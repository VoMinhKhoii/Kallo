import {
  profileSettingsSchema,
  sharingPreferencesSchema,
} from '@/lib/api/contracts/onboarding';
import {
  authed,
  fromZod,
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
        'The full data export: profile, meals, weights, and circle activity. This is the machine-readable half of the data rights described in the privacy policy.',
      tags: TAGS,
      ok: ref('Acknowledgement'),
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
      body: fromZod(sharingPreferencesSchema),
      ok: ref('Acknowledgement'),
    }),
  },
};
