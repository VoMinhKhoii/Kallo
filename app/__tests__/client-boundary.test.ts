import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { directive, parseSource } from '@/lib/__test-utils__/source-ast';

// A Server Component that imports a plain value (a constant, a function) from
// a 'use client' module does not get the value: the bundler hands it a client
// reference. Nothing fails — it just never matches. The logging page read its
// timezone cookie that way for two months, so its empty-day hint was always
// "unknown" and every empty day jumped the composer (layout shift 0.25 on a
// phone, prod 2026-10-27). Unit tests cannot see it (no RSC transform), so
// this checks the source: server code under app/ may import only components
// from a 'use client' module. Move shared values to a plain module.

const ROOT = process.cwd();

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

function resolveAlias(specifier: string) {
  if (!specifier.startsWith('@/')) return undefined;
  const base = path.join(ROOT, specifier.slice(2));
  return [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find(existsSync);
}

/** A React component name: PascalCase with at least one lowercase letter
 *  (so `OAuthErrorToast` is one and `TIMEZONE_COOKIE` is not). */
const isComponentName = (name: string) => /^[A-Z](?=.*[a-z])\w*$/.test(name);

function plainClientImports() {
  const hits: string[] = [];
  const clientModules = new Map<string, boolean>();
  const isClientModule = (file: string) => {
    if (!clientModules.has(file)) {
      clientModules.set(file, directive(parseSource(file)) === 'use client');
    }
    return clientModules.get(file);
  };

  for (const file of sourceFiles(path.join(ROOT, 'app'))) {
    const source = parseSource(file);
    if (directive(source) === 'use client') continue;
    for (const statement of source.program.body) {
      if (statement.type !== 'ImportDeclaration') continue;
      if (statement.importKind === 'type') continue;
      const target = resolveAlias(statement.source.value);
      if (!target || !isClientModule(target)) continue;
      for (const specifier of statement.specifiers) {
        if (specifier.type !== 'ImportSpecifier') continue;
        const { imported } = specifier;
        const name =
          imported.type === 'Identifier' ? imported.name : imported.value;
        if (specifier.importKind === 'type' || isComponentName(name)) continue;
        hits.push(
          `${path.relative(ROOT, file)} imports ${name} from ${path.relative(ROOT, target)}`
        );
      }
    }
  }
  return hits;
}

describe('server/client boundary', () => {
  it("server code under app/ imports only components from 'use client' modules", () => {
    expect(plainClientImports()).toEqual([]);
  });
});
