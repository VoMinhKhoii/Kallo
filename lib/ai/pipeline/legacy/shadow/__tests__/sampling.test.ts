import { describe, expect, it } from 'vitest';
import {
  isShadowSampled,
  SHADOW_SAMPLING_RATE,
} from '@/lib/ai/pipeline/legacy/shadow/sampling';

describe('isShadowSampled', () => {
  it('returns false when the feature flag is off', () => {
    expect(isShadowSampled('any-id', { enabled: false })).toBe(false);
  });

  it('returns true for ~5% of request IDs at 0.05 sampling rate', () => {
    let hits = 0;
    const n = 10_000;
    for (let i = 0; i < n; i++) {
      if (isShadowSampled(`req-${i}`, { enabled: true })) hits++;
    }

    expect(hits / n).toBeGreaterThan(0.04);
    expect(hits / n).toBeLessThan(0.06);
  });

  it('is deterministic — same requestId always routes the same way', () => {
    const id = 'req-abc-123';
    const a = isShadowSampled(id, { enabled: true });
    const b = isShadowSampled(id, { enabled: true });
    const c = isShadowSampled(id, { enabled: true });

    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('exports the locked 0.05 sampling rate', () => {
    expect(SHADOW_SAMPLING_RATE).toBe(0.05);
  });
});
