/**
 * Shared request-schema re-exports for the `/api/v1/*` contract surface.
 *
 * Both the web hooks and the future mobile API client import validators from
 * `@/lib/api/contracts/*` so there is a single source of truth. The canonical
 * definitions still live in `lib/validation.ts`; these are re-exports.
 */
export { dateStringSchema, timezoneOffsetSchema } from '@/lib/validation';
