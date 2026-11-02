import { readFileSync } from 'node:fs';
import { parse } from '@babel/parser';
import type {
  CallExpression,
  File,
  Node,
  OptionalCallExpression,
} from '@babel/types';

// Source-reading tests (the server/client boundary, the latency ratchets)
// parse product files with Babel: TypeScript 7 no longer ships the compiler
// API they used to call.

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

const NOT_CHILDREN = new Set([
  'loc',
  'start',
  'end',
  'extra',
  'range',
  'leadingComments',
  'trailingComments',
  'innerComments',
]);

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { type?: unknown }).type === 'string';

/**
 * Visit `node` and everything under it, depth first. `ancestors` runs from the
 * root to the visited node's parent; read it during the call, do not keep it.
 */
export function walk(
  node: Node,
  visit: (node: Node, ancestors: readonly Node[]) => void,
  ancestors: Node[] = []
) {
  visit(node, ancestors);
  ancestors.push(node);
  for (const [key, value] of Object.entries(node)) {
    if (NOT_CHILDREN.has(key)) continue;
    for (const child of Array.isArray(value) ? value : [value]) {
      if (isNode(child)) walk(child, visit, ancestors);
    }
  }
  ancestors.pop();
}

/** A call, optional (`fn?.()`) or not. */
export const isCall = (
  node: Node
): node is CallExpression | OptionalCallExpression =>
  node.type === 'CallExpression' || node.type === 'OptionalCallExpression';

/** `<object>.<name>` or `<object>?.<name>`, the name written out (not `[x]`). */
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
