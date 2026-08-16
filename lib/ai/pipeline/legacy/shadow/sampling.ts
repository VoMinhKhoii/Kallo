import { createHash } from 'node:crypto';

/** Per Decision B (locked): static 5% of traffic, deterministic per request. */
export const SHADOW_SAMPLING_RATE = 0.05 as const;

export interface ShadowSamplingConfig {
  enabled: boolean;
  /** Override for tests. Production should pass nothing and let it default. */
  rate?: number;
}

/**
 * Deterministic per-`requestId` sampling. SHA-256 the request id, take the
 * first 4 bytes as an unsigned int, divide by 2^32. Routes consistently across
 * retries within a single request because the request_id is generated once at
 * pipeline start.
 */
export function isShadowSampled(
  requestId: string,
  config: ShadowSamplingConfig
): boolean {
  if (!config.enabled) return false;
  const rate = config.rate ?? SHADOW_SAMPLING_RATE;
  const hash = createHash('sha256').update(requestId).digest();
  const u32 = hash.readUInt32BE(0);
  return u32 / 0x1_0000_0000 < rate;
}
