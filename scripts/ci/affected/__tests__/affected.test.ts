import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  dockerfileCopies,
  groupsFor,
  importClosure,
  repoFacts,
  resolveImport,
} from '../affected.mjs';

const ROOT = process.cwd();
const REPO = repoFacts(ROOT);
if (REPO === null) throw new Error('git could not list this checkout');
const DB = REPO.dbFiles;
const groups = (files: string[] | null) => groupsFor(files, REPO);
const NONE = { web: false, migrations: false, image: false, deps: false };
const ALL = { web: true, migrations: true, image: true, deps: true };

describe('groupsFor', () => {
  it('runs everything when the diff or the checkout is unknown', () => {
    expect(groups(null)).toEqual(ALL);
    expect(groups([])).toEqual(ALL);
    expect(groupsFor(['docs/X.md'], null)).toEqual(ALL);
  });

  it('skips every gated job for a Flutter-only PR', () => {
    expect(groups(['apps/mobile-flutter/lib/main.dart'])).toEqual(NONE);
    // A pub dependency change is still one for Dependency Review.
    expect(groups(['apps/mobile-flutter/pubspec.lock'])).toEqual({
      ...NONE,
      deps: true,
    });
  });

  it('runs Dependency Review only for manifests and action versions', () => {
    for (const file of [
      'apps/kallo-proxy/package.json',
      'apps/mobile-flutter/pubspec.yaml',
      '.github/workflows/flutter-ci.yml',
    ]) {
      expect([file, groups([file]).deps]).toEqual([file, true]);
    }
    expect(groups(['lib/seo/site.ts']).deps).toBe(false);
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

  // docs/brand/kallo/exploration/ holds a unit test that reads the SVG and
  // HTML around it, so a change there is a web change after all.
  it('runs the web jobs for files beside a test under an ignored path', () => {
    for (const file of [
      'docs/brand/kallo/exploration/logo-concepts.test.ts',
      'docs/brand/kallo/exploration/concepts/01-calibrated-letter.svg',
      'docs/brand/kallo/exploration/index.html',
    ]) {
      expect(groups([file]).web).toBe(true);
    }
    expect(groups(['docs/brand/kallo/README.md']).web).toBe(false);
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
    expect(groups(['supabase/migrations/20261102000000_x.sql'])).toEqual({
      web: true,
      migrations: true,
      image: false,
      deps: false,
    });
    expect(groups(['supabase/config.toml']).migrations).toBe(true);
    expect(groups(['lib/seo/site.ts'])).toEqual({
      web: true,
      migrations: false,
      image: false,
      deps: false,
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

  it('builds the PR image only for what the Docker build alone can break', () => {
    for (const file of [
      'Dockerfile',
      '.dockerignore',
      'next.config.ts',
      'public/favicon.ico',
      'scripts/ci/card-index/check-runtime.mjs',
      // Copied into the image by hand, read from the Dockerfile:
      'lib/ai/matching/cards/search-index/worker.mjs',
      'lib/ai/matching/cards/search-index/search-core.mjs',
    ]) {
      expect([file, groups([file]).image]).toEqual([file, true]);
    }
    expect(groups(['app/[locale]/page.tsx']).image).toBe(false);
    expect(
      groups(['lib/ai/matching/cards/search-index/search-index.ts']).image
    ).toBe(false);
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

describe('dockerfileCopies', () => {
  it('lists hand-copied repo paths, not build output or node_modules', () => {
    const dockerfile = [
      'COPY --from=builder /app/.next/standalone ./',
      'COPY --from=builder \\',
      '  /app/lib/x/worker.mjs \\',
      '  /app/lib/x/core.mjs \\',
      '  ./lib/x/',
      'COPY --from=builder /app/node_modules/usearch/package.json ./x',
      'COPY --from=builder /app/lib/x/worker.mjs ./again',
    ].join('\n');
    expect(dockerfileCopies(dockerfile)).toEqual([
      'lib/x/worker.mjs',
      'lib/x/core.mjs',
    ]);
  });
});

describe('repoFacts', () => {
  it('lists only test folders under ignored paths, never the repo root', () => {
    expect(REPO.testDirs).toContain('docs/brand/kallo/exploration/');
    for (const dir of REPO.testDirs) {
      expect(dir === '/' || dir === './').toBe(false);
    }
  });

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
