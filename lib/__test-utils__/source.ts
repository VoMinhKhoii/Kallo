import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import {
  type CallExpression,
  type File,
  type Node,
  type OptionalCallExpression,
  VISITOR_KEYS,
} from '@babel/types';

// What a source-reading test (the server/client boundary, the latency
// ratchets) needs to read product code: the files, `@/` imports, and a Babel
// parse. TypeScript 7 no longer ships the compiler API these tests used.

export const ROOT = process.cwd();

/** Every `.ts`/`.tsx` file under `dir`, skipping tests and declarations. */
export function sourceFiles(dir: string, out: string[] = []): string[] {
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

/** The file an `@/` import names; undefined for anything else. */
export function resolveAlias(specifier: string): string | undefined {
  if (!specifier.startsWith('@/')) return undefined;
  const base = path.join(ROOT, specifier.slice(2));
  return [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find(existsSync);
}

/** `file` parsed as TypeScript, with JSX for `.tsx`. */
export function parseSource(file: string): File {
  return parse(readFileSync(file, 'utf8'), {
    sourceType: 'module',
    plugins: file.endsWith('.tsx') ? ['typescript', 'jsx'] : ['typescript'],
  });
}

/** The module's first directive (`'use client'`, `'use server'`), if any. */
export function directive(source: File): string | null {
  return source.program.directives[0]?.value.value ?? null;
}

/**
 * Visit `node` and everything under it, depth first, along Babel's own child
 * keys. `ancestors` runs from the root to the visited node's parent; read it
 * during the call, do not keep it.
 */
export function walk(
  node: Node,
  visit: (node: Node, ancestors: readonly Node[]) => void
) {
  const ancestors: Node[] = [];
  const go = (current: Node) => {
    visit(current, ancestors);
    ancestors.push(current);
    for (const key of VISITOR_KEYS[current.type] ?? []) {
      const value = (current as unknown as Record<string, unknown>)[key] as
        | Node
        | (Node | null)[]
        | null
        | undefined;
      for (const child of Array.isArray(value) ? value : [value]) {
        if (child) go(child);
      }
    }
    ancestors.pop();
  };
  go(node);
}

/** A call, optional (`fn?.()`) or not. */
export const isCall = (
  node: Node
): node is CallExpression | OptionalCallExpression =>
  node.type === 'CallExpression' || node.type === 'OptionalCallExpression';

/** The object of `<object>.<name>` or `<object>?.<name>` (not `[name]`). */
export function memberObject(node: Node, name: string): Node | null {
  if (
    node.type !== 'MemberExpression' &&
    node.type !== 'OptionalMemberExpression'
  ) {
    return null;
  }
  if (node.computed || node.property.type !== 'Identifier') return null;
  return node.property.name === name ? node.object : null;
}

/** The 1-based line `node` starts on. */
export function lineOf(node: Node): number {
  if (!node.loc) throw new Error(`${node.type} has no source location`);
  return node.loc.start.line;
}
