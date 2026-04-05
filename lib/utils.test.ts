import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn utility', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('resolves Tailwind conflicts (last wins)', () => {
    expect(cn('px-4', 'px-8')).toBe('px-8');
  });

  it('handles undefined and null inputs', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
  });

  it('returns empty string for no inputs', () => {
    expect(cn()).toBe('');
  });
});
