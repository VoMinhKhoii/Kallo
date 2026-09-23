import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Shared by the spec-vs-routes tests: walk `app/api`, map each route file to
 * its OpenAPI path, and slice its source per exported HTTP method. Plain
 * source scanning, not a TypeScript parse — the route files are small and
 * uniform, and a check that needs a compiler would be the first to be skipped.
 */

export const API_ROOT = path.join(process.cwd(), 'app', 'api');

export const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

export function walkRoutes(dir: string = API_ROOT, out: string[] = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkRoutes(full, out);
    else if (/^route\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** `app/api/v1/meals/[mealId]/route.ts` → `/api/v1/meals/{mealId}`. */
export function toSpecPath(file: string): string {
  const rel = path.relative(process.cwd(), file);
  return `/${rel
    .replace(/^app\//, '')
    .replace(/\/route\.tsx?$/, '')
    .split('/')
    .map((segment) =>
      segment.startsWith('[')
        ? `{${segment.replace(/[[\]]|\.\.\./g, '')}}`
        : segment
    )
    .join('/')}`;
}

const EXPORT_RE =
  /export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g;

export function exportedMethods(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const declared = [...source.matchAll(EXPORT_RE)].map((match) =>
    match[1].toLowerCase()
  );
  return [...new Set(declared)].sort();
}

/**
 * Each exported handler's source, from its `export` to the next handler's
 * (or the end of the file). Lowercased method → source slice.
 */
export function handlerSources(source: string): Map<string, string> {
  const matches = [...source.matchAll(EXPORT_RE)];
  const out = new Map<string, string>();
  matches.forEach((match, i) => {
    const end = matches[i + 1]?.index ?? source.length;
    out.set(match[1].toLowerCase(), source.slice(match.index, end));
  });
  return out;
}
