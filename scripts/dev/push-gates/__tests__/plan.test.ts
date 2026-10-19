import { describe, expect, it } from 'vitest';
import { gatesFor, pushDirectory } from '../plan.mjs';

const CWD = '/repo';

describe('pushDirectory', () => {
  it.each([
    ['git push', CWD],
    ['git push -u origin feat/x', CWD],
    ['git add a.ts && git commit -m "x" && git push', CWD],
    ['cd /work/tree && git push -u origin chore/y', '/work/tree'],
    ['cd sub && cd deeper; git push', '/repo/sub/deeper'],
    ['cd "/path with space" && git push', '/path with space'],
    ['git -C /other/tree push origin HEAD', '/other/tree'],
    ['GIT_TRACE=1 git push', CWD],
    ['git push 2>&1 | tail -5', CWD],
  ])('gates %j from %s', (command, dir) => {
    expect(pushDirectory(command, CWD)).toBe(dir);
  });

  it.each([
    ['git status'],
    ['git commit -m "fix: run the gates before git push"'],
    ['echo git push'],
    ['git push --dry-run'],
    ['git push -n origin x'],
    ['git push --delete origin old'],
    ['git push -d origin old'],
    ['git push origin :old'],
    ['gh pr create --title "push it"'],
  ])('ignores %j', (command) => {
    expect(pushDirectory(command, CWD)).toBeNull();
  });
});

describe('gatesFor', () => {
  const names = (changed: string[] | null) =>
    gatesFor(changed).map((g: { name: string }) => g.name);

  it('runs every web gate when the diff is unknown', () => {
    expect(names(null)).toEqual(['structure', 'biome', 'tsc']);
  });

  it('skips tsc for a docs-only change', () => {
    expect(names(['docs/X.md'])).toEqual(['structure', 'biome']);
  });

  it('runs tsc when TypeScript or package.json changes', () => {
    expect(names(['lib/a.ts'])).toContain('tsc');
    expect(names(['package.json'])).toContain('tsc');
  });

  it('runs only structure and flutter analyze for a mobile-only change', () => {
    expect(names(['apps/mobile-flutter/lib/main.dart'])).toEqual([
      'structure',
      'flutter analyze',
    ]);
  });

  it('checks migration timestamps when a migration changes', () => {
    expect(names(['supabase/migrations/20261019000000_x.sql'])).toContain(
      'migrations'
    );
  });
});
