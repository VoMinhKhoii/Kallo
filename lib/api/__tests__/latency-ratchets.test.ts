import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { File, Node } from '@babel/types';
import { describe, expect, it } from 'vitest';
import {
  directive,
  isCall,
  memberObject,
  parseSource,
  walk,
} from '@/lib/__test-utils__/source-ast';

// Latency ratchets: deterministic counts that stand in for two measured
// costs, so a later change cannot quietly bring either back (PRs #499, #500).
//
// 1. A web read that runs as a Server Action waits in the browser's one-at-a-
//    time action queue (Next's router runs actions serially): /logging once
//    queued five reads, ~0.4 s each, behind each other. Reads go through GET
//    routes instead.
// 2. `supabase.auth.getUser()` is a round trip to the Auth server, which shares
//    the free-plan database box: 32 ms p50 but 0.6 s p95 and 1 s p99 in prod.
//    Hot paths verify the token locally (`verifyUser`).

const ROOT = process.cwd();
const SOURCE_DIRS = ['app', 'components', 'hooks', 'lib'];

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

const files = SOURCE_DIRS.flatMap((dir) => sourceFiles(path.join(ROOT, dir)));
const parsed = new Map(files.map((file) => [file, parseSource(file)]));
const rel = (file: string) => path.relative(ROOT, file);
const lineOf = (node: Node) => node.loc?.start.line ?? 0;

function resolveAlias(specifier: string): string | undefined {
  if (!specifier.startsWith('@/')) return undefined;
  const base = path.join(ROOT, specifier.slice(2));
  return [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find(existsSync);
}

/** Local names this file imports from Server Action modules. */
function serverActionImports(source: File) {
  const names = new Map<string, string>();
  for (const statement of source.program.body) {
    if (statement.type !== 'ImportDeclaration') continue;
    if (statement.importKind === 'type') continue;
    const target = resolveAlias(statement.source.value);
    const targetSource = target && parsed.get(target);
    if (!targetSource || directive(targetSource) !== 'use server') continue;
    for (const specifier of statement.specifiers) {
      if (specifier.type !== 'ImportSpecifier') continue;
      if (specifier.importKind === 'type') continue;
      names.set(specifier.local.name, rel(target));
    }
  }
  return names;
}

/** Every `queryFn` property whose body calls a Server Action directly. */
function queryFnsCallingServerActions() {
  const hits: string[] = [];
  for (const [file, source] of parsed) {
    const actions = serverActionImports(source);
    if (actions.size === 0) continue;
    walk(source, (node) => {
      if (
        node.type !== 'ObjectProperty' ||
        node.computed ||
        node.shorthand ||
        node.key.type !== 'Identifier' ||
        node.key.name !== 'queryFn'
      ) {
        return;
      }
      walk(node.value, (inner) => {
        if (
          isCall(inner) &&
          inner.callee.type === 'Identifier' &&
          actions.has(inner.callee.name)
        ) {
          hits.push(
            `${rel(file)}:${lineOf(inner)} calls ${inner.callee.name} (${actions.get(inner.callee.name)})`
          );
        }
      });
    });
  }
  return hits;
}

/** `<x>.auth.getUser(...)` call sites, as `file:line`. */
function getUserCalls(within?: (node: Node) => boolean) {
  const hits: string[] = [];
  for (const [file, source] of parsed) {
    walk(source, (node, ancestors) => {
      if (!isCall(node)) return;
      const auth = memberObject(node.callee, 'getUser');
      if (
        auth &&
        memberObject(auth, 'auth') &&
        (!within || ancestors.some(within))
      ) {
        hits.push(`${rel(file)}:${lineOf(node)}`);
      }
    });
  }
  return hits;
}

/** The request paths every signed-in API call, page load or page render
 *  runs through. None of them may ask the Auth server. */
const HOT_AUTH_FUNCTIONS = new Set([
  'requireUserId',
  'requireUserWithAvatar',
  'requireAuthAndProfile',
  'resolveAuthAndProfile',
  'getRequestUser',
  'verifyUser',
  'updateSession',
  'validateRequest',
  'SessionAppShell',
  'getAuthUser',
]);

function inHotAuthFunction(node: Node) {
  if (node.type === 'FunctionDeclaration') {
    return (
      node.id !== null &&
      node.id !== undefined &&
      HOT_AUTH_FUNCTIONS.has(node.id.name)
    );
  }
  if (
    (node.type === 'ClassMethod' || node.type === 'ObjectMethod') &&
    node.kind === 'method'
  ) {
    return (
      !node.computed &&
      node.key.type === 'Identifier' &&
      HOT_AUTH_FUNCTIONS.has(node.key.name)
    );
  }
  return (
    node.type === 'VariableDeclarator' &&
    node.id.type === 'Identifier' &&
    HOT_AUTH_FUNCTIONS.has(node.id.name)
  );
}

/**
 * Every `auth.getUser(` left in product code. The rare account routes that
 * need the full user (linked identities) or a fresh read keep it on purpose.
 * Ratchet: the count must EQUAL this ceiling. A change that adds a call fails;
 * a change that removes one must lower the number here in the same PR, so
 * the win is locked in.
 */
const GET_USER_CALL_CEILING = 15;

describe('latency ratchets', () => {
  it('no query reads through a Server Action (they run one at a time)', () => {
    expect(queryFnsCallingServerActions()).toEqual([]);
  });

  it('the hot auth paths never ask the Auth server', () => {
    expect(getUserCalls(inHotAuthFunction)).toEqual([]);
  });

  it(`auth.getUser() call sites stay at ${GET_USER_CALL_CEILING}`, () => {
    const calls = getUserCalls();
    expect(
      calls.length,
      calls.length > GET_USER_CALL_CEILING
        ? `A new auth.getUser() call is a round trip to the Auth server (0.6 s p95). Verify locally with getRequestUser()/verifyUser() instead:\n${calls.join('\n')}`
        : `auth.getUser() calls dropped to ${calls.length}: lower GET_USER_CALL_CEILING to lock the win in.`
    ).toBe(GET_USER_CALL_CEILING);
  });
});
