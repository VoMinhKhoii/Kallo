import { describe, expect, it } from 'vitest';
import { countLines, shouldExclude } from '../check-file-length';

describe('shouldExclude', () => {
  it('excludes node_modules paths', () => {
    expect(shouldExclude('node_modules/foo/bar.ts')).toBe(true);
  });

  it('excludes .next paths', () => {
    expect(shouldExclude('.next/server/app.ts')).toBe(true);
  });

  it('excludes schema.ts', () => {
    expect(shouldExclude('lib/db/schema.ts')).toBe(true);
  });

  it('excludes .generated. files', () => {
    expect(shouldExclude('lib/types.generated.ts')).toBe(true);
  });

  it('does not exclude regular ts files', () => {
    expect(shouldExclude('lib/utils.ts')).toBe(false);
  });

  it('does not exclude similar but non-matching names', () => {
    expect(shouldExclude('lib/schemas.ts')).toBe(false);
  });
});

describe('countLines', () => {
  it('counts lines correctly', () => {
    expect(countLines('a\nb\nc')).toBe(3);
  });

  it('returns 0 for empty string', () => {
    expect(countLines('')).toBe(0);
  });

  it('returns 1 for single line', () => {
    expect(countLines('hello')).toBe(1);
  });

  it('counts trailing newline as extra line', () => {
    expect(countLines('a\nb\n')).toBe(3);
  });
});
