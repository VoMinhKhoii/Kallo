import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

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

const parse = (file: string) =>
  ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

function directive(source: ts.SourceFile) {
  const first = source.statements[0];
  return first &&
    ts.isExpressionStatement(first) &&
    ts.isStringLiteral(first.expression)
    ? first.expression.text
    : null;
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
      clientModules.set(file, directive(parse(file)) === 'use client');
    }
    return clientModules.get(file);
  };

  for (const file of sourceFiles(path.join(ROOT, 'app'))) {
    const source = parse(file);
    if (directive(source) === 'use client') continue;
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement)) continue;
      if (statement.importClause?.isTypeOnly) continue;
      const target = resolveAlias(
        (statement.moduleSpecifier as ts.StringLiteral).text
      );
      if (!target || !isClientModule(target)) continue;
      const bindings = statement.importClause?.namedBindings;
      if (!bindings || !ts.isNamedImports(bindings)) continue;
      for (const element of bindings.elements) {
        const name = (element.propertyName ?? element.name).text;
        if (element.isTypeOnly || isComponentName(name)) continue;
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
