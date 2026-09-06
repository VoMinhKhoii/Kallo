import type { PathItem } from '@/lib/api/openapi/components';
import { ACCOUNT_PATHS } from '@/lib/api/openapi/paths/account';
import { LOGGING_PATHS } from '@/lib/api/openapi/paths/logging';
import { MEAL_PATHS } from '@/lib/api/openapi/paths/meals';
import { NOTIFICATION_PATHS } from '@/lib/api/openapi/paths/notifications';
import { NUTRITION_PATHS } from '@/lib/api/openapi/paths/nutrition';
import { ONBOARDING_PATHS } from '@/lib/api/openapi/paths/onboarding';
import { PUBLIC_PATHS } from '@/lib/api/openapi/paths/public';
import { FRIEND_PATHS } from '@/lib/api/openapi/paths/social/friends';
import { GROUP_PATHS } from '@/lib/api/openapi/paths/social/groups';
import { SHARE_PATHS } from '@/lib/api/openapi/paths/social/shares';
import { SUPPORT_PATHS } from '@/lib/api/openapi/paths/support';
import { TRACKING_PATHS } from '@/lib/api/openapi/paths/tracking';
import { SCHEMAS } from '@/lib/api/openapi/schemas';
import { SITE_URL } from '@/lib/seo/site';

/**
 * The published OpenAPI 3.1 description of Kallo's HTTP API.
 *
 * Scope is deliberate. It covers `/api/v1/*` and `/api/healthz` — the surface
 * the web and mobile clients use — and omits four route families on purpose:
 * the RevenueCat and Supabase-Auth webhooks (signature-verified provider
 * callbacks that no caller should ever invoke), the Supabase auth proxy
 * (internal plumbing), and the admin-only analyse-meal debug endpoint (which
 * answers 404 rather than 403 to non-admins, and documenting it would undo
 * that). `openapi.test.ts` enforces that list rather than leaving it to memory.
 *
 * Almost every operation is marked `x-internal: true`. That is honest, not
 * defensive: these endpoints exist to serve Kallo's own clients, there is no
 * third-party key programme, and an agent should know it is reading an
 * implementation rather than a contract before it builds on one.
 */

const PATHS: Record<string, PathItem> = {
  ...PUBLIC_PATHS,
  ...MEAL_PATHS,
  ...LOGGING_PATHS,
  ...NUTRITION_PATHS,
  ...TRACKING_PATHS,
  ...GROUP_PATHS,
  ...FRIEND_PATHS,
  ...SHARE_PATHS,
  ...NOTIFICATION_PATHS,
  ...ACCOUNT_PATHS,
  ...ONBOARDING_PATHS,
  ...SUPPORT_PATHS,
};

const DESCRIPTION = `The HTTP API behind Kallo, a nutrition tracker that starts from a sentence rather than a search box.

## Authentication

Every endpoint except those tagged \`Public\` needs a Supabase-issued user JWT in \`Authorization: Bearer <jwt>\`. There is no API-key programme and no OAuth authorization server: the only way to obtain a token today is to sign in as a Kallo user. Protected-resource metadata is published at [/.well-known/oauth-protected-resource](${SITE_URL}/.well-known/oauth-protected-resource) per RFC 9728, and it deliberately declares no scopes, because the tokens carry none.

## Errors

Every documented API error returns the same envelope: \`{ "error": { "code", "status", "retryable", "message", "resolution" } }\`. \`code\` is stable and machine-readable; \`retryable\` says whether repeating the identical request could ever succeed; \`resolution\` gives the next machine-actionable step. Any \`/api/*\` path with no handler returns a 404 in this same shape, never HTML. Redirect-only operations and the health probe document their own non-error responses explicitly.

## Stability

Operations marked \`x-internal\` serve Kallo's own web and mobile clients and may change without a version bump. The \`Public\` tag marks the handful that are safe to depend on.

Human documentation: [${SITE_URL}/en/docs/developers/api](${SITE_URL}/en/docs/developers/api).`;

export function openApiDocument() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Kallo API',
      version: '1.0.0',
      summary: 'Nutrition logging from natural-language meal descriptions.',
      description: DESCRIPTION,
      contact: {
        name: 'Kallo support',
        email: 'support@kallo.fit',
        url: `${SITE_URL}/en/docs/company/contact`,
      },
      license: { name: 'Proprietary', url: `${SITE_URL}/en/docs/legal/terms` },
      termsOfService: `${SITE_URL}/en/docs/legal/terms`,
    },
    servers: [{ url: SITE_URL, description: 'Production' }],
    externalDocs: {
      description: 'Developer documentation',
      url: `${SITE_URL}/en/docs/developers/api`,
    },
    tags: [
      { name: 'Public', description: 'Callable with no credentials.' },
      { name: 'Meals', description: 'Logging, editing and re-logging meals.' },
      {
        name: 'Logging',
        description: 'The day view and the non-AI logging paths.',
      },
      {
        name: 'Nutrition',
        description: 'Micronutrients, and reading a label from a photo.',
      },
      { name: 'Tracking', description: 'Dashboard and weight.' },
      { name: 'Circle', description: 'Friends, groups and shared meals.' },
      {
        name: 'Activity',
        description: 'The per-person activity feed and its seen/read state.',
      },
      { name: 'Account', description: 'Profile, export, deletion.' },
      {
        name: 'Billing',
        description: 'Entitlements and checkout configuration.',
      },
      { name: 'Onboarding', description: 'First-run setup.' },
      { name: 'Support', description: 'Feedback and bug reports.' },
      {
        name: 'Reference data',
        description:
          'The food-composition tables behind every estimate: the Vietnam National Food Composition Table 2007, plus FAO and USDA.',
      },
    ],
    components: {
      securitySchemes: {
        supabaseBearer: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'A Supabase Auth access token for a Kallo user. The token carries no scopes — it grants whatever that user can do — so an agent acting on someone’s behalf holds their full account authority. Treat it accordingly.',
        },
      },
      schemas: SCHEMAS,
    },
    security: [],
    paths: PATHS,
  };
}
