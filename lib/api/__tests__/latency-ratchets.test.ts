import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

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
const parsed = new Map(
  files.map((file) => [
    file,
    ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    ),
  ])
);
const rel = (file: string) => path.relative(ROOT, file);

/** A module whose first statement is the `'use server'` directive. */
function isServerActionModule(source: ts.SourceFile) {
  const first = source.statements[0];
  return (
    first !== undefined &&
    ts.isExpressionStatement(first) &&
    ts.isStringLiteral(first.expression) &&
    first.expression.text === 'use server'
  );
}

function resolveAlias(specifier: string): string | undefined {
  if (!specifier.startsWith('@/')) return undefined;
  const base = path.join(ROOT, specifier.slice(2));
  return [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find(existsSync);
}

/** Local names this file imports from Server Action modules. */
function serverActionImports(source: ts.SourceFile) {
  const names = new Map<string, string>();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (statement.importClause?.isTypeOnly) continue;
    const target = resolveAlias(
      (statement.moduleSpecifier as ts.StringLiteral).text
    );
    const targetSource = target && parsed.get(target);
    if (!targetSource || !isServerActionModule(targetSource)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      if (element.isTypeOnly) continue;
      names.set(element.name.text, rel(target));
    }
  }
  return names;
}

function walk(node: ts.Node, visit: (node: ts.Node) => void) {
  visit(node);
  node.forEachChild((child) => walk(child, visit));
}

/** Every `queryFn` property whose body calls a Server Action directly. */
function queryFnsCallingServerActions() {
  const hits: string[] = [];
  for (const [file, source] of parsed) {
    const actions = serverActionImports(source);
    if (actions.size === 0) continue;
    walk(source, (node) => {
      if (
        !ts.isPropertyAssignment(node) ||
        node.name.getText(source) !== 'queryFn'
      ) {
        return;
      }
      walk(node.initializer, (inner) => {
        if (
          ts.isCallExpression(inner) &&
          ts.isIdentifier(inner.expression) &&
          actions.has(inner.expression.text)
        ) {
          const { line } = source.getLineAndCharacterOfPosition(
            inner.getStart(source)
          );
          hits.push(
            `${rel(file)}:${line + 1} calls ${inner.expression.text} (${actions.get(inner.expression.text)})`
          );
        }
      });
    });
  }
  return hits;
}

/** `<x>.auth.getUser(...)` call sites, as `file:line`. */
function getUserCalls(within?: (node: ts.Node) => boolean) {
  const hits: string[] = [];
  for (const [file, source] of parsed) {
    walk(source, (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'getUser' &&
        ts.isPropertyAccessExpression(node.expression.expression) &&
        node.expression.expression.name.text === 'auth' &&
        (!within || hasAncestor(node, within))
      ) {
        const { line } = source.getLineAndCharacterOfPosition(
          node.getStart(source)
        );
        hits.push(`${rel(file)}:${line + 1}`);
      }
    });
  }
  return hits;
}

function hasAncestor(node: ts.Node, match: (node: ts.Node) => boolean) {
  for (let current = node.parent; current; current = current.parent) {
    if (match(current)) return true;
  }
  return false;
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

function inHotAuthFunction(node: ts.Node) {
  if (
    (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) &&
    node.name &&
    HOT_AUTH_FUNCTIONS.has(node.name.getText())
  ) {
    return true;
  }
  return (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    HOT_AUTH_FUNCTIONS.has(node.name.text)
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
