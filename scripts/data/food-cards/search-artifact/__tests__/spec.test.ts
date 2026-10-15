import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { describe, expect, it } from 'vitest';
import { artifactKey, buildSpec, SPEC_FILES } from '../spec';

const ENTRY =
  'scripts/data/food-cards/search-artifact/build-search-artifact.ts';

/** Local modules a file loads at runtime (type-only imports excluded). */
function localImports(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const specifiers = [
    ...source.matchAll(/^import\s+(?!type\s)[\s\S]*?from\s+'([^']+)'/gm),
    ...source.matchAll(/import\(\s*'([^']+)'\s*\)/g),
  ].map((m) => m[1]);
  const out: string[] = [];
  for (const spec of specifiers) {
    let base: string;
    if (spec.startsWith('@/')) base = spec.slice(2);
    else if (spec.startsWith('.')) base = normalize(join(dirname(file), spec));
    else continue; // node: builtins and npm packages
    const candidates = [base, `${base}.ts`, `${base}.mjs`, `${base}/index.ts`];
    const found = candidates.find((c) => existsSync(c) && !c.endsWith('/'));
    if (!found) throw new Error(`cannot resolve ${spec} from ${file}`);
    out.push(found);
  }
  return out;
}

function importGraph(entry: string): string[] {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    queue.push(...localImports(file));
  }
  return [...seen].sort();
}

describe('artifact spec', () => {
  it('hashes exactly the local modules the builder runs', () => {
    expect(importGraph(ENTRY)).toEqual([...SPEC_FILES].sort());
  });

  it('changes the key when the data or the spec changes', () => {
    const spec = buildSpec();
    const key = artifactKey({ catalog: 'a' }, spec);
    expect(artifactKey({ catalog: 'a' }, spec)).toBe(key);
    expect(artifactKey({ catalog: 'b' }, spec)).not.toBe(key);
    expect(artifactKey({ catalog: 'a' }, { ...spec, code: 'other' })).not.toBe(
      key
    );
  });

  it('records the installed usearch and the matchable sources', () => {
    const spec = buildSpec();
    expect(spec.usearch).toBe('2.26.2');
    expect(spec.matchableSourceCodes).toContain('USDA_SR');
    expect(spec.code).toMatch(/^[0-9a-f]{64}$/);
  });
});
