import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '@/lib/core/errors/codes';

/** Plain source scan over `app/` and `lib/`, skipping tests. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__' && entry.name !== 'node_modules') {
        sourceFiles(full, out);
      }
    } else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

// `new AppError('CODE', 404, ...)` and a subclass's `super('CODE', 429, ...)`,
// on one line or wrapped after the paren.
const CODE_LITERAL = /(?:new AppError|super)\(\s*'([A-Za-z_]+)',\s*\d{3}\b/g;

describe('ERROR_CODES', () => {
  it('lists every code an AppError is constructed with', () => {
    const found = new Set<string>();
    for (const root of ['app', 'lib']) {
      for (const file of sourceFiles(path.join(process.cwd(), root))) {
        for (const match of readFileSync(file, 'utf8').matchAll(CODE_LITERAL)) {
          found.add(match[1]);
        }
      }
    }

    // Guards the scan itself: an empty set would pass the check below.
    expect(found).toContain('BARCODE_NOT_CACHED');
    expect(found).toContain('RATE_LIMITED');
    const listed = new Set<string>(ERROR_CODES);
    expect([...found].filter((code) => !listed.has(code))).toEqual([]);
  });

  it('has no duplicates', () => {
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
  });
});
