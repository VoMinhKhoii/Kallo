import {
  authed,
  fromZod,
  type JsonSchema,
  PAYLOAD_TOO_LARGE_ERROR,
  type PathItem,
  ref,
} from '@/lib/api/openapi/components';
import { mealMessageSchema } from '@/lib/core/validation/meal';

/**
 * One SSE frame: `event: <type>\ndata: <json>\n\n`, where the JSON repeats the
 * `type` (see `encodeSSE` in `lib/ai/streaming/encoder.ts`). Mirrors the
 * `StreamEvent` union in `lib/ai/streaming/types.ts`.
 */
const event = (
  type: string,
  description: string,
  properties: Record<string, JsonSchema>
): JsonSchema => ({
  type: 'object',
  description,
  required: ['type', ...Object.keys(properties)],
  properties: { type: { type: 'string', enum: [type] }, ...properties },
});

const STREAM_EVENT: JsonSchema = {
  description:
    'The `data:` payload of one frame. The SSE `event:` name equals `type`. Exactly one of `analysis_complete` or `error` is the last frame, after which the stream closes.',
  oneOf: [
    event('stage', 'Progress: which pipeline stage is running.', {
      stage: {
        type: 'string',
        enum: [
          'authenticating',
          'decomposing',
          'matching',
          'estimating',
          'assembling',
        ],
      },
    }),
    event('item_name', 'A dish name, as soon as decomposition finds it.', {
      name: { type: 'string' },
      index: { type: 'integer', minimum: 0 },
      mealItemId: {
        type: 'string',
        description: 'Run-scoped id that later `item_macros` frames reuse.',
      },
    }),
    event('item_macros', 'One dish with its estimated nutrition.', {
      mealItemId: { type: 'string' },
      item: { type: 'object', description: 'The estimated meal item.' },
    }),
    event('result', 'The assembled estimate (precise mode).', {
      data: { type: 'object', description: 'The parsed meal for review.' },
    }),
    event('cheat_estimate', 'A slider spec instead of a result (cheat mode).', {
      spec: { type: 'object', description: 'The cheat slider spec.' },
    }),
    event(
      'analysis_complete',
      'Terminal. The estimate is staged; pass `analysisId` to `confirmMeal`.',
      { analysisId: { type: 'string', format: 'uuid' } }
    ),
    event('error', 'Terminal. The analysis failed mid-stream.', {
      code: { type: 'string' },
      message: { type: 'string' },
      retryable: { type: 'boolean' },
    }),
  ],
};

/**
 * Published as a named component so a client can generate the frame type. The
 * response body itself is framed text holding many of these, not one of them,
 * so it is documented as a string that points here.
 */
export const ANALYSIS_SCHEMAS: Record<string, JsonSchema> = {
  AnalyzeMealStreamEvent: STREAM_EVENT,
};

const SSE_BODY: JsonSchema = {
  type: 'string',
  description:
    'Server-sent events text: a sequence of frames, each `event: <type>\\ndata: <json>\\n\\n`. Every `data` line is one `AnalyzeMealStreamEvent` (see `#/components/schemas/AnalyzeMealStreamEvent`).',
  'x-sse-event-data': ref('AnalyzeMealStreamEvent'),
};

/** The describe-a-meal analysis stream — the read step before `confirmMeal`. */
export const ANALYSIS_PATHS: Record<string, PathItem> = {
  '/api/analyze-meal': {
    post: authed({
      operationId: 'analyzeMeal',
      summary: 'Estimate a meal from a sentence (streamed)',
      description:
        'Runs the analysis pipeline on a free-text meal description and streams progress as server-sent events (`text/event-stream`), ending in `analysis_complete` with the id of a staged analysis, or in `error`. Nothing is logged: confirm the staged analysis with `confirmMeal`. Auth, body validation (400, or 413 for a body over the cap), billing (402), the per-user concurrency guard (429) and a scanned pick that was never cached (404 `BARCODE_NOT_CACHED`) are all checked BEFORE the stream opens and answer with the ordinary JSON error envelope; once the stream has started, a failure can only arrive as an `error` frame.',
      tags: ['Meals'],
      body: fromZod(mealMessageSchema),
      ok: SSE_BODY,
      okMedia: 'text/event-stream',
      okDescription:
        'An SSE stream. Each frame is `event: <type>` followed by `data: <json>`; the body is text, and each `data` payload is an `AnalyzeMealStreamEvent`.',
      extraErrors: PAYLOAD_TOO_LARGE_ERROR,
    }),
  },
};
