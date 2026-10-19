import { describe, expect, it } from 'vitest';
import { gatesFor, pushedCommits } from '../plan.mjs';

const names = (changed: string[] | null) =>
  gatesFor(changed).map((g: { name: string }) => g.name);

describe('gatesFor', () => {
  it('runs every gate when the diff is unknown', () => {
    expect(names(null)).toEqual([
      'structure',
      'biome',
      'tsc',
      'migrations',
      'dart format',
      'flutter analyze',
    ]);
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

  it('runs only structure and the Flutter gates for a mobile-only change', () => {
    expect(names(['apps/mobile-flutter/lib/main.dart'])).toEqual([
      'structure',
      'dart format',
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

describe('pushedCommits', () => {
  const A = 'a'.repeat(40);
  const B = 'b'.repeat(40);
  const ZERO = '0'.repeat(40);

  it('lists each published commit once, skipping deletions', () => {
    expect(
      pushedCommits(
        `refs/heads/x ${A} refs/heads/x ${ZERO}\n(delete) ${ZERO} refs/heads/old ${B}\nrefs/heads/y ${A} refs/heads/y ${ZERO}\nrefs/tags/v1 ${B} refs/tags/v1 ${ZERO}\n`
      )
    ).toEqual([A, B]);
  });

  it('is empty for deletions only, or nothing at all', () => {
    expect(pushedCommits(`(delete) ${ZERO} refs/heads/old ${A}\n`)).toEqual([]);
    expect(pushedCommits('')).toEqual([]);
  });
});
