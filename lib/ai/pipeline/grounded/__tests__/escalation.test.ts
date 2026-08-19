import { describe, expect, it } from 'vitest';
import {
  isV2EscalationEnabled,
  shouldEscalateV2,
} from '@/lib/ai/pipeline/grounded/escalation';

// ---------------------------------------------------------------------------
// Escalation gate (SAFE, default off)
// ---------------------------------------------------------------------------

describe('shouldEscalateV2 — gated escalation seam', () => {
  const withCandidate = { hasEscalationCandidate: true };
  const nextProfile = { escalationModel: 'gemini-3-flash-preview' };
  const stableProfile = { escalationModel: null };

  it('does NOT fire when the flag is off (default), even with a candidate on next', () => {
    expect(
      shouldEscalateV2({
        profile: nextProfile,
        summary: withCandidate,
        env: {},
      })
    ).toBe(false);
  });

  it('does NOT fire on stable (no escalationModel) even with the flag on', () => {
    expect(
      shouldEscalateV2({
        profile: stableProfile,
        summary: withCandidate,
        env: { PIPELINE_V2_ESCALATION: 'on' },
      })
    ).toBe(false);
  });

  it('does NOT fire when there is no escalation candidate', () => {
    expect(
      shouldEscalateV2({
        profile: nextProfile,
        summary: { hasEscalationCandidate: false },
        env: { PIPELINE_V2_ESCALATION: 'on' },
      })
    ).toBe(false);
  });

  it('fires only when flag on AND escalationModel set AND a candidate exists', () => {
    expect(
      shouldEscalateV2({
        profile: nextProfile,
        summary: withCandidate,
        env: { PIPELINE_V2_ESCALATION: 'on' },
      })
    ).toBe(true);
  });

  it('isV2EscalationEnabled treats only "on" as enabled', () => {
    expect(isV2EscalationEnabled({ PIPELINE_V2_ESCALATION: 'on' })).toBe(true);
    expect(isV2EscalationEnabled({ PIPELINE_V2_ESCALATION: 'true' })).toBe(
      false
    );
    expect(isV2EscalationEnabled({})).toBe(false);
  });
});
