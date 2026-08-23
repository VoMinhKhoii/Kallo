import { heatmapQuerySchema } from '@/lib/api/contracts/dashboard';
import { weightLogSchema } from '@/lib/api/contracts/weight';
import {
  authed,
  dateParam,
  fromZod,
  type PathItem,
  pathParam,
  ref,
  tzParam,
} from '@/lib/api/openapi/components';

const TAGS = ['Tracking'];

/** The dashboard aggregate, and weight. */
export const TRACKING_PATHS: Record<string, PathItem> = {
  '/api/v1/dashboard': {
    get: authed({
      operationId: 'getDashboard',
      summary: 'The whole dashboard in one request',
      description:
        'Collapses four calls — profile, day, weight summary, adherence heatmap — into one round-trip. Each slice is byte-identical to its standalone endpoint, so a client can seed four caches from this one response. Ranges are fixed to what the dashboard renders: weight 30 days, heatmap 90.',
      tags: TAGS,
      parameters: [dateParam, tzParam],
      ok: ref('DashboardBundle'),
    }),
  },

  '/api/v1/dashboard/heatmap': {
    get: authed({
      operationId: 'getAdherenceHeatmap',
      summary: 'Calorie-adherence grid',
      description:
        'One cell per day: whether it was logged, and how close intake came to the target. Under-logged days are marked `partial` and carry a null `ratio` rather than being graded as poor adherence — a day you forgot to log is not a day you overate.',
      tags: TAGS,
      parameters: [
        {
          name: 'range',
          in: 'query',
          required: true,
          description: 'Window to render.',
          schema: fromZod(heatmapQuerySchema.shape.range),
        },
        tzParam,
      ],
      ok: ref('Heatmap'),
    }),
  },

  '/api/v1/weight': {
    post: authed({
      operationId: 'logWeight',
      summary: 'Log a weight',
      description:
        'Records a weight for a date. Logging the same date twice replaces the earlier value rather than adding a second one.',
      tags: TAGS,
      body: fromZod(weightLogSchema),
      ok: ref('WeightSummary'),
      okDescription: 'The refreshed summary, so a client need not re-fetch.',
    }),
  },

  '/api/v1/weight/{loggedDate}': {
    delete: authed({
      operationId: 'deleteWeight',
      summary: 'Delete a logged weight',
      description: 'Removes the weight entry for one date.',
      tags: TAGS,
      parameters: [pathParam('loggedDate', 'The date to clear, `YYYY-MM-DD`.')],
      ok: ref('Acknowledgement'),
    }),
  },

  '/api/v1/weight/summary': {
    get: authed({
      operationId: 'getWeightSummary',
      summary: 'Weight trend over a range',
      description:
        'The weight series plus the trend the clients draw. The projection is computed server-side so web and mobile never disagree about the forecast, and `canProject` is false when there is too little data for it to mean anything.',
      tags: TAGS,
      parameters: [
        {
          name: 'range',
          in: 'query',
          required: true,
          description:
            'Window. Note this is narrower than the heatmap range — no `year`.',
          schema: { type: 'string', enum: ['30d', '90d'] },
        },
        tzParam,
      ],
      ok: ref('WeightSummary'),
    }),
  },
};
