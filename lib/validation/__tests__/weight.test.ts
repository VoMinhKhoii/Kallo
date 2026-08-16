import { describe, expect, it } from 'vitest';
import { weightLogSchema } from '@/lib/validation/weight';

describe('weightLogSchema', () => {
  it('accepts a real calendar date', () => {
    const result = weightLogSchema.safeParse({
      loggedDate: '2026-04-24',
      weightKg: 70.5,
    });

    expect(result.success).toBe(true);
  });

  it('rejects impossible calendar dates', () => {
    const result = weightLogSchema.safeParse({
      loggedDate: '2026-02-30',
      weightKg: 70.5,
    });

    expect(result.success).toBe(false);
  });
});
