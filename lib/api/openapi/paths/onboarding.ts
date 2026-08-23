import { onboardingScreenSchema } from '@/lib/api/contracts/onboarding';
import {
  authed,
  fromZod,
  type PathItem,
  ref,
} from '@/lib/api/openapi/components';

const TAGS = ['Onboarding'];

/** First-run setup, and the nudge that follows an unfinished one. */
export const ONBOARDING_PATHS: Record<string, PathItem> = {
  '/api/v1/onboarding/profile': {
    get: authed({
      operationId: 'getOnboardingProfile',
      summary: 'The caller’s profile and targets',
      description:
        'Body metrics, goal, region and cooking habits, plus the targets derived from them. Null for a user who never finished onboarding — that is a normal state, not an error.',
      tags: TAGS,
      ok: ref('OnboardingProfile'),
    }),
  },

  '/api/v1/onboarding/screen': {
    post: authed({
      operationId: 'submitOnboardingScreen',
      summary: 'Submit one onboarding step',
      description:
        'Onboarding is saved a screen at a time so a user who abandons halfway keeps what they entered.',
      tags: TAGS,
      body: fromZod(onboardingScreenSchema),
      ok: ref('OnboardingProfile'),
    }),
  },

  '/api/v1/onboarding/nudge/minimize': {
    post: authed({
      operationId: 'minimizeOnboardingNudge',
      summary: 'Collapse the finish-setup prompt',
      description:
        'Hides the reminder to finish onboarding without dismissing it forever.',
      tags: TAGS,
      ok: ref('Acknowledgement'),
    }),
  },

  '/api/v1/onboarding/nudge/restore': {
    post: authed({
      operationId: 'restoreOnboardingNudge',
      summary: 'Bring the finish-setup prompt back',
      description: 'The inverse of `minimizeOnboardingNudge`.',
      tags: TAGS,
      ok: ref('Acknowledgement'),
    }),
  },
};
