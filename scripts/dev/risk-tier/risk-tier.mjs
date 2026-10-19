#!/usr/bin/env node
// The review tier of a change, from the paths it touches (never from who wrote
// it). /ship sizes its review loop by it and prints it in the PR body; the
// rules are in docs/REVIEW_TIERS.md. CLI: prints the tier of the branch's diff
// against origin/main as JSON.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Paths where a bug has cost data, money, sign-ins, a deploy or a meal's
// numbers. Any one of them makes the change high.
const HIGH = [
  [
    'database schema or migration',
    /^(?:supabase\/migrations\/|drizzle\/|lib\/infra\/db\/schema\.ts$)/,
  ],
  [
    'auth or session',
    /^(?:proxy\.ts$|app\/auth\/|app\/api\/(?:v1\/)?auth\/|app\/api\/supabase-proxy\/|lib\/infra\/(?:auth|apple-auth|supabase|email)\/|apps\/mobile-flutter\/lib\/(?:services|features)\/auth\/)/,
  ],
  [
    'billing or entitlements',
    /^(?:lib\/domain\/billing\/|app\/api\/webhooks\/|app\/api\/v1\/account\/|(?:hooks|components)\/billing\/|apps\/mobile-flutter\/lib\/(?:services\/billing|features\/paywall)\/)/,
  ],
  [
    'account export or deletion',
    /^(?:lib\/domain\/account-(?:export|deletion)\/|scripts\/ops\/)/,
  ],
  [
    'CI, deploy or release',
    /^(?:\.github\/(?:workflows|actions)\/|scripts\/cloud-run\/|Dockerfile|apps\/mobile-flutter\/(?:ios|fastlane)\/)/,
  ],
  [
    'AI meal pipeline',
    /^(?:lib\/ai\/(?:pipeline|matching|portion|provider|prompts)\/|app\/api\/analyze-meal\/)/,
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
  const reasons = [];
  for (const [label, pattern] of HIGH) {
    const hit = files.find((f) => pattern.test(f));
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
