import { z } from 'zod';
import { Errors } from '@/lib/errors/catalog';

const MAX_UUID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const POSTGRES_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::?\d{2})?)$/;

const cursorPayloadSchema = z.object({
  ts: z.string().min(1).max(64).regex(POSTGRES_TIMESTAMP),
  id: z.string().uuid(),
});

export interface SharedMealCursor {
  ts: string;
  id: string;
}

/** Decode the opaque tuple cursor. A plain ISO timestamp remains a supported
 * legacy input and sorts before the maximum UUID at that exact timestamp. */
export function decodeSharedMealCursor(
  value: string | undefined
): SharedMealCursor | null {
  if (!value) return null;

  const legacy = z.string().datetime({ offset: true }).safeParse(value);
  if (legacy.success) {
    return { ts: legacy.data, id: MAX_UUID };
  }

  try {
    const payload: unknown = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8')
    );
    return cursorPayloadSchema.parse(payload);
  } catch {
    throw Errors.validationFailed('Con trỏ dòng thức ăn không hợp lệ.');
  }
}

export function encodeSharedMealCursor(cursor: SharedMealCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}
