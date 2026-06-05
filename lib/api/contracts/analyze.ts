/**
 * Contract for the meal-analysis SSE endpoint (`POST /api/analyze-meal`).
 *
 * There is no new route for analysis — the existing SSE route handles it. This
 * contract exposes the request schema so the mobile SSE client validates the
 * body with the exact same rules as the web feed submit. Streamed event types
 * (`StreamEvent`) are imported directly from `@/lib/ai/streaming` by clients.
 */

export type { MealMessageInput } from '@/lib/validation';
export { mealMessageSchema } from '@/lib/validation';
