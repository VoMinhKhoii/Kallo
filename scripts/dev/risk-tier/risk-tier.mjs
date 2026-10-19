#!/usr/bin/env node
// The review tier of a change, from the paths it touches (never from who wrote
// it). /ship sizes its review loop by it and prints it in the PR body; the
// rules are in docs/REVIEW_TIERS.md. CLI: prints the tier of the branch's diff
// against origin/main as JSON.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Paths where a bug has cost data, money, sign-ins, a deploy or a meal's
// numbers. A changed file under any of these prefixes makes the change high.
const FLUTTER = 'apps/mobile-flutter/';
const HIGH = [
  [
    'database schema, client or migration',
    ['supabase/migrations/', 'drizzle/', 'lib/infra/db/'],
  ],
  [
    'auth or session',
    [
      'proxy.ts',
      'supabase/config.toml',
      'app/auth/',
      'app/api/auth/',
      'app/api/v1/auth/',
      'app/api/supabase-proxy/',
      'app/.well-known/',
      'app/[locale]/reset-password/',
      'lib/api/auth.ts',
      'lib/core/validation/password.ts',
      'lib/domain/apple-sign-in/',
      'lib/infra/auth/',
      'lib/infra/apple-auth/',
      'lib/infra/supabase/',
      'lib/infra/email/',
      'lib/admin/authz/',
      'hooks/auth/',
      'components/auth/',
      'components/landing-page/signed-in-redirect.tsx',
      `${FLUTTER}lib/services/auth/`,
      `${FLUTTER}lib/features/auth/`,
      `${FLUTTER}lib/router_redirect.dart`,
    ],
  ],
  [
    'security infrastructure',
    ['lib/infra/security/', 'lib/infra/crypto/', 'lib/infra/rate-limit/'],
  ],
  [
    'billing or entitlements',
    [
      'lib/domain/billing/',
      'app/api/webhooks/',
      'app/api/v1/account/',
      'app/[locale]/pricing/',
      'app/[locale]/(app)/admin/premium/',
      'lib/admin/premium/',
      'hooks/billing/',
      'components/billing/',
      'components/landing-page/pricing/',
      'components/admin/premium/',
      `${FLUTTER}lib/services/billing/`,
      `${FLUTTER}lib/features/paywall/`,
      `${FLUTTER}lib/features/settings/logic/delete_subscription_warning.dart`,
    ],
  ],
  [
    'account data or privacy consent',
    [
      'lib/domain/account-export/',
      'lib/domain/account-deletion/',
      'lib/domain/privacy/',
      'lib/actions/identity/',
      'lib/actions/privacy/',
      'app/api/v1/profile/ai-consent/',
      'components/settings/account/',
      'components/settings/privacy/',
      'components/privacy/',
      'scripts/ops/',
      `${FLUTTER}lib/features/privacy/`,
      `${FLUTTER}lib/features/settings/screens/account_`,
      `${FLUTTER}lib/features/settings/widgets/account/`,
    ],
  ],
  [
    'CI, deploy or release',
    [
      '.github/workflows/',
      '.github/actions/',
      'scripts/ci/',
      'scripts/cloud-run/',
      'Dockerfile',
      'next.config',
      'release-please-config.json',
      '.release-please-manifest.json',
      `${FLUTTER}ios/`,
      `${FLUTTER}fastlane/`,
    ],
  ],
  [
    'AI meal pipeline',
    [
      'lib/ai/pipeline/',
      'lib/ai/matching/',
      'lib/ai/portion/',
      'lib/ai/provider/',
      'lib/ai/prompts/',
      'app/api/analyze-meal/',
    ],
  ],
];

// Paths that cannot change what the app does. A change made only of these is
// low.
const LOW = [
  /\.md$/,
  /^(?:docs|content\/docs|\.agents)\//,
  /^\.claude\/(?:skills|agents|commands)\//,
  /\/__tests__\//,
  /^(?:e2e|apps\/mobile-flutter\/test)\//,
  /^scripts\/(?:eval|bench)\//,
];

/** `{ tier: 'low' | 'medium' | 'high', reasons: string[] }` for changed paths. */
export function tierFor(files) {
  // A test beside high-risk code cannot break it in prod.
  const shipped = files.filter((f) => !/\/__tests__\//.test(f));
  const reasons = [];
  for (const [label, prefixes] of HIGH) {
    const hit = shipped.find((f) => prefixes.some((p) => f.startsWith(p)));
    if (hit) reasons.push(`${label}: ${hit}`);
  }
  if (reasons.length > 0) return { tier: 'high', reasons };
  if (files.every((f) => LOW.some((pattern) => pattern.test(f)))) {
    return { tier: 'low', reasons: ['docs, agent instructions or tests only'] };
  }
  return {
    tier: 'medium',
    reasons: ['product code outside the high-risk paths'],
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const base = process.argv[2] ?? 'origin/main';
  const files = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
  process.stdout.write(`${JSON.stringify(tierFor(files), null, 2)}\n`);
}
