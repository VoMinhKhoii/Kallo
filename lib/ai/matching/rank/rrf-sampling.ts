import { createHash } from 'node:crypto';

export const RRF_FLAG_KEY = 'RRF_MEASUREMENT_ENABLED';
export const RRF_RATE_KEY = 'RRF_SAMPLE_RATE';

function parseRate(raw: string | undefined): number {
  if (!raw) return 0;
  const rate = Number(raw);
  if (!Number.isFinite(rate)) return 0;
  if (rate < 0) return 0;
  if (rate > 1) return 1;
  return rate;
}

function bucket(requestId: string): number {
  const hash = createHash('sha256').update(requestId).digest();
  return hash.readUInt32BE(0) / 0x1_0000_0000;
}

export function shouldSampleForRrf(requestId: string): boolean {
  if (process.env[RRF_FLAG_KEY] !== 'true') return false;

  const rate = parseRate(process.env[RRF_RATE_KEY]);
  if (rate === 0) return false;
  if (rate === 1) return true;

  return bucket(requestId) < rate;
}
