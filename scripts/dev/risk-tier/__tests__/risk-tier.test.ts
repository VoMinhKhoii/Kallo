import { describe, expect, it } from 'vitest';
import { tierFor } from '../risk-tier.mjs';

const tier = (files: string[]) => tierFor(files).tier;

describe('tierFor', () => {
  it.each([
    ['supabase/migrations/20261019000000_x.sql'],
    ['lib/infra/db/schema.ts'],
    ['proxy.ts'],
    ['app/api/auth/send-email/route.ts'],
    ['lib/domain/billing/entitlement/grant.ts'],
    ['apps/mobile-flutter/lib/features/paywall/paywall_screen.dart'],
    ['lib/domain/account-deletion/delete.ts'],
    ['lib/api/auth.ts'],
    ['hooks/auth/use-google-identity.ts'],
    ['components/auth/auth-provider.tsx'],
    ['lib/actions/identity/account.ts'],
    [
      'apps/mobile-flutter/lib/features/settings/screens/account_delete_screen.dart',
    ],
    ['supabase/config.toml'],
    ['apps/mobile-flutter/lib/router_redirect.dart'],
    ['components/landing-page/pricing/checkout/pricing-checkout-provider.tsx'],
    ['components/settings/account/use-account-actions.ts'],
    ['lib/admin/premium/accounts/lookup.ts'],
    ['lib/domain/privacy/consent-gate.ts'],
    ['lib/infra/db/client.ts'],
    ['lib/infra/rate-limit/limiter/limiter.ts'],
    ['scripts/ci/check-structure/check-structure.mjs'],
    ['release-please-config.json'],
    ['next.config.ts'],
    ['.github/workflows/ci.yml'],
    ['scripts/cloud-run/deploy.sh'],
    ['lib/ai/pipeline/grounded/orchestrator.ts'],
    ['lib/ai/matching/streamed-matching.ts'],
  ])('%s is high', (file) => {
    expect(tier([file])).toBe('high');
  });

  it('names every high reason with its first file', () => {
    expect(
      tierFor(['docs/X.md', 'proxy.ts', 'lib/domain/billing/a.ts']).reasons
    ).toEqual([
      'auth or session: proxy.ts',
      'billing or entitlements: lib/domain/billing/a.ts',
    ]);
  });

  it('does not count a test beside high-risk code as high', () => {
    expect(tier(['lib/ai/pipeline/grounded/__tests__/review.test.ts'])).toBe(
      'low'
    );
  });

  it.each([
    [['docs/DATABASE.md', 'README.md']],
    [['.claude/skills/ship/SKILL.md']],
    [['components/logging/__tests__/feed.test.tsx']],
    [['apps/mobile-flutter/test/features/home_test.dart']],
    [['scripts/eval/run.ts', 'content/docs/en/account/delete.mdx']],
  ])('%j is low', (files) => {
    expect(tier(files)).toBe('low');
  });

  it.each([
    [['components/logging/feed/feed.tsx']],
    [['messages/en/groups.json']],
    [['public/portions/bowl.webp']],
    [['.claude/settings.json']],
    [['docs/X.md', 'lib/ai/cost/cost.ts']],
  ])('%j is medium', (files) => {
    expect(tier(files)).toBe('medium');
  });
});

describe('tierFor with file contents', () => {
  const read = (f: string) =>
    f === 'lib/actions/logging/nutrition-ocr.ts'
      ? "await assertFeatureAccess(userId, 'label_scan');"
      : 'export const x = 1;';

  it('treats any file that enforces a paid feature as high', () => {
    expect(tierFor(['lib/actions/logging/nutrition-ocr.ts'], read)).toEqual({
      tier: 'high',
      reasons: [
        'billing or entitlements (enforces a paid feature): lib/actions/logging/nutrition-ocr.ts',
      ],
    });
    expect(tierFor(['lib/actions/meals/other.ts'], read).tier).toBe('medium');
  });

  it('treats fixtures beside high-risk code as test-only', () => {
    expect(tier(['lib/infra/db/__fixtures__/fake-db.ts'])).toBe('low');
  });

  it('leaves the generated release manifest out of high', () => {
    expect(tier(['.release-please-manifest.json'])).toBe('medium');
  });
});
