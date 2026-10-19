import { describe, expect, it } from 'vitest';
import { gatesFor } from '../plan.mjs';

const names = (changed: string[] | null) =>
  gatesFor(changed).map((g: { name: string }) => g.name);

describe('gatesFor', () => {
  it('runs every web gate when the diff is unknown', () => {
    expect(names(null)).toEqual(['structure', 'biome', 'tsc']);
  });

  it('skips tsc for a prose-only change', () => {
    expect(names(['docs/X.md', 'content/docs/en/a.mdx'])).toEqual([
      'structure',
      'biome',
    ]);
  });

  it('runs tsc for code, package.json and message catalogs', () => {
    expect(names(['lib/a.ts'])).toContain('tsc');
    expect(names(['package.json'])).toContain('tsc');
    expect(names(['messages/en/errors.json'])).toContain('tsc');
  });

  it('runs only structure and flutter analyze for a mobile-only change', () => {
    expect(names(['apps/mobile-flutter/lib/main.dart'])).toEqual([
      'structure',
      'flutter analyze',
    ]);
  });

  it('checks migration order against main when a migration changes', () => {
    const gate = gatesFor(['supabase/migrations/20261019000000_x.sql']).find(
      (g: { name: string }) => g.name === 'migrations'
    );
    expect(gate?.env).toEqual({ GITHUB_BASE_REF: 'main' });
  });
});
