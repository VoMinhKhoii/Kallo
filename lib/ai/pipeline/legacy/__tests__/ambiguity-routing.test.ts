import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('ambiguityFlags routing guard', () => {
  it('does not let compute-policy read ambiguityFlags', async () => {
    const code = await readFile(
      'lib/ai/pipeline/legacy/compute-policy.ts',
      'utf-8'
    );

    expect(code).not.toMatch(/ambiguityFlags/);
  });
});
