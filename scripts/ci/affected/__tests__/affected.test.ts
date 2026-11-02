import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  dbTestFiles,
  GROUPS,
  groupsFor,
  importClosure,
  resolveImport,
} from '../affected.mjs';
import { JOBS } from '../verify.mjs';

const ROOT = process.cwd();
const DB = dbTestFiles(ROOT);
const groups = (files: string[] | null) => groupsFor(files, DB);
const NONE = { web: false, migrations: false };
const ALL = { web: true, migrations: true };

describe('groupsFor', () => {
  it('runs everything when the diff is unknown or empty', () => {
    expect(groups(null)).toEqual(ALL);
    expect(groups([])).toEqual(ALL);
  });

  it('skips every gated job for a Flutter-only PR', () => {
    expect(
      groups([
        'apps/mobile-flutter/lib/main.dart',
        'apps/mobile-flutter/pubspec.lock',
      ])
    ).toEqual(NONE);
  });

  it('skips them for docs, Markdown and agent files', () => {
    expect(
      groups([
        'docs/DATABASE.md',
        'AGENTS.md',
        'apps/docs/mobile/releasing.md',
        '.claude/skills/ship/SKILL.md',
        '.agents/skills/x/run.sh',
        '.tuturuuu/tasks/plan.md',
      ])
    ).toEqual(NONE);
  });

  it('runs the web jobs for prose a web job reads', () => {
    // The docs pages import MDX; the security review reads its prompt.
    expect(groups(['content/docs/en/overview.mdx']).web).toBe(true);
    expect(groups(['.github/security-review/audit-prompt.md']).web).toBe(true);
  });

  it('runs the web jobs for a file no rule knows', () => {
    expect(groups(['wrangler.toml']).web).toBe(true);
    expect(groups(['apps/kallo-proxy/src/index.ts']).web).toBe(true);
  });

  it('runs everything when CI itself or the dependencies change', () => {
    for (const file of [
      '.github/workflows/ci.yml',
      '.github/actions/setup-bun/action.yml',
      'scripts/ci/affected/affected.mjs',
      'package.json',
      'bun.lock',
    ]) {
      expect(groups(['docs/X.md', file])).toEqual(ALL);
    }
  });

  it('runs the migrations job for supabase/ and nothing else in a web PR', () => {
    expect(groups(['supabase/migrations/20261102000000_x.sql'])).toEqual(ALL);
    expect(groups(['supabase/config.toml']).migrations).toBe(true);
    expect(groups(['lib/seo/site.ts'])).toEqual({
      web: true,
      migrations: false,
    });
  });

  // The article's warning: a change the skip logic cannot see must not skip
  // the tests that cover it. These files are reached only through imports.
  it('runs the migrations job for code the database suites import', () => {
    for (const file of [
      'lib/infra/rate-limit/limiter/sql-consumer.ts',
      'lib/infra/db/client.ts',
      'lib/core/errors/catalog.ts',
      'vitest.setup.ts',
    ]) {
      expect(groups([file]).migrations).toBe(true);
    }
  });

  it('counts both paths of a rename', () => {
    expect(
      groups(['apps/mobile-flutter/lib/x.dart', 'lib/core/x.ts']).web
    ).toBe(true);
  });
});

describe('importClosure', () => {
  it('follows the @/ alias and relative imports, transitively', () => {
    const closure = importClosure(ROOT, [
      'lib/infra/rate-limit/limiter/__tests__/rate-limit-consume.db.test.ts',
    ]);
    expect(closure).toContain('lib/infra/rate-limit/limiter/sql-consumer.ts');
    expect(closure).toContain('lib/core/errors/app-error.ts');
  });
});

describe('dbTestFiles', () => {
  it('starts from every *.db.test.ts suite', () => {
    expect(DB).toContain(
      'lib/infra/rate-limit/limiter/__tests__/rate-limit-consume.db.test.ts'
    );
    expect(DB).toContain(
      'lib/infra/rate-limit/limiter/__tests__/rate-limit-spend.db.test.ts'
    );
  });

  // A specifier the resolver cannot follow would hide that file and all it
  // imports. Packages are left to package.json/bun.lock, which run everything.
  it('resolves every repo import in what the suites load', () => {
    const specifier =
      /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\bvi\.mock\(\s*|\brequire\(\s*)['"]((?:@\/|\.)[^'"]*)['"]/g;
    const unresolved: string[] = [];
    for (const file of DB) {
      const source = readFileSync(path.join(ROOT, file), 'utf8');
      for (const [, spec] of source.matchAll(specifier)) {
        if (spec && resolveImport(ROOT, file, spec) === null) {
          unresolved.push(`${file}: ${spec}`);
        }
      }
    }
    expect(unresolved).toEqual([]);
  });
});

// ci.yml, read as text: the job blocks under `jobs:`.
const CI = readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
function jobBlocks(): Map<string, string> {
  const body = CI.slice(CI.indexOf('\njobs:\n'));
  const blocks = new Map<string, string>();
  const keys = [...body.matchAll(/^ {2}([a-z0-9-]+):\s*$/gm)];
  keys.forEach((match, i) => {
    const end = keys[i + 1]?.index ?? body.length;
    blocks.set(match[1] as string, body.slice(match.index, end));
  });
  return blocks;
}
function needsOf(block: string): string[] {
  const inline = block.match(/^ {4}needs: \[?([^\]\n]*)\]?$/m);
  if (inline?.[1]) return inline[1].split(',').map((n) => n.trim());
  const list = block.match(/^ {4}needs:\n((?: {6}- .+\n)+)/m);
  return list?.[1]
    ? [...list[1].matchAll(/- (.+)/g)].map((m) => m[1] as string)
    : [];
}

describe('ci.yml agrees with the skip rules', () => {
  const blocks = jobBlocks();
  const gated = [...blocks.keys()].filter((name) => name !== 'ci-passed');

  it('has a verify.mjs rule for every job, and no rule for a missing job', () => {
    expect(Object.keys(JOBS).sort()).toEqual(gated.sort());
  });

  it('makes CI passed wait for every job', () => {
    expect(needsOf(blocks.get('ci-passed') ?? '').sort()).toEqual(
      Object.keys(JOBS).sort()
    );
  });

  it('gates each job on exactly its own group', () => {
    for (const [name, job] of Object.entries(JOBS)) {
      const block = blocks.get(name) ?? '';
      for (const group of GROUPS) {
        const gate = `needs.changes.outputs.${group} == 'true'`;
        expect([name, block.includes(gate)]).toEqual([
          name,
          job.group === group,
        ]);
      }
      if (job.group !== 'always') expect(needsOf(block)).toContain('changes');
    }
  });

  it('exposes every group as an output of the changes job', () => {
    const block = blocks.get('changes') ?? '';
    for (const group of GROUPS) {
      expect(block).toContain(
        `${group}: \${{ steps.affected.outputs.${group} }}`
      );
    }
  });

  it('runs the suites dbTestFiles starts from in the migrations job', () => {
    expect(blocks.get('migrations')).toContain('bun run test -- .db.test.ts');
  });
});
