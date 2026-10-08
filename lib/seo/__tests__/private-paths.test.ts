import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { needsSignIn, PRIVATE_PATH_PREFIXES } from '@/lib/seo/private-paths';

// The list is hand-maintained, and a route missing from it silently loses the
// signed-out redirect, its robots Disallow, and markdown negotiation (`/activity`
// drifted exactly that way). Pin it to the folders under the `(app)` group.
const APP_GROUP = join(process.cwd(), 'app/[locale]/(app)');

describe('PRIVATE_PATH_PREFIXES', () => {
  it('lists every route under app/[locale]/(app)/', () => {
    const routes = readdirSync(APP_GROUP, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
      .map((entry) => `/${entry.name}`);

    expect(routes.length).toBeGreaterThan(0);
    expect([...PRIVATE_PATH_PREFIXES].sort()).toEqual(routes.sort());
  });
});

describe('needsSignIn', () => {
  it('matches a private surface and the pages under it', () => {
    expect(needsSignIn('/dashboard')).toBe(true);
    expect(needsSignIn('/settings/account')).toBe(true);
  });

  it('does not match a lookalike or a public page', () => {
    expect(needsSignIn('/dashboards')).toBe(false);
    expect(needsSignIn('/pricing')).toBe(false);
  });

  it('leaves /admin out so the redirect never names it', () => {
    expect(needsSignIn('/admin')).toBe(false);
    expect(needsSignIn('/admin/prompts')).toBe(false);
  });
});
