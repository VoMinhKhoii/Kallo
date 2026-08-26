import {
  cheatRepeatSchema,
  confirmMealSchema,
  duplicateMealBodySchema,
  relogItemsSchema,
  saveManualMealSchema,
  stageRelogAnalysisSchema,
  updateMealBodySchema,
} from '@/lib/api/contracts/meals';
import {
  authed,
  dateParam,
  fromZod,
  limitParam,
  type PathItem,
  pathParam,
  ref,
  tzParam,
} from '@/lib/api/openapi/components';

const TAGS = ['Meals'];

/** Reading, editing and re-logging meals — the core of the product. */
export const MEAL_PATHS: Record<string, PathItem> = {
  '/api/v1/meals': {
    get: authed({
      operationId: 'listMeals',
      summary: 'List a day’s meals',
      description:
        'Every meal logged on one calendar day, with its items and macros.',
      tags: TAGS,
      parameters: [dateParam, tzParam],
      ok: ref('MealList'),
    }),
  },

  '/api/v1/meals/{mealId}': {
    patch: authed({
      operationId: 'updateMeal',
      summary: 'Edit a logged meal',
      description:
        'Adjusts the grams of individual items, or removes them. Nutrition is recomputed server-side from composition data — the client never sends calorie or macro figures.',
      tags: TAGS,
      parameters: [pathParam('mealId', 'UUID of the meal to edit.')],
      body: fromZod(updateMealBodySchema),
      ok: ref('Meal'),
    }),
    delete: authed({
      operationId: 'deleteMeal',
      summary: 'Delete a logged meal',
      description: 'Removes the meal and every item under it. Not reversible.',
      tags: TAGS,
      parameters: [pathParam('mealId', 'UUID of the meal to delete.')],
      ok: ref('Acknowledgement'),
    }),
  },

  '/api/v1/meals/{mealId}/duplicate': {
    post: authed({
      operationId: 'duplicateMeal',
      summary: 'Copy a meal to another day',
      description:
        'Copies an existing meal, items and all, onto the given date. `newMealId` is a client-generated UUID so an optimistic card and the persisted row share a key.',
      tags: TAGS,
      parameters: [pathParam('mealId', 'UUID of the meal to copy.')],
      body: fromZod(duplicateMealBodySchema),
      ok: ref('Meal'),
      okStatus: '201',
      okDescription: 'The new meal.',
    }),
  },

  '/api/v1/meals/confirm': {
    post: authed({
      operationId: 'confirmMeal',
      summary: 'Persist an analysed meal',
      description:
        'Turns a staged analysis into a saved meal. This is the write step of the describe-a-meal flow: `POST /api/analyze-meal` produces the estimate, the user corrects it, and this commits it.',
      tags: TAGS,
      body: fromZod(confirmMealSchema),
      ok: ref('Meal'),
      okStatus: '201',
    }),
  },

  '/api/v1/meals/manual': {
    post: authed({
      operationId: 'logMealManually',
      summary: 'Log a meal from ingredient ids and grams',
      description:
        'Deterministic logging with no AI in the path: the client sends food-composition ids and gram weights, the server computes nutrition from per-100g data and saves the meal. Use this when the caller already knows exactly what was eaten.',
      tags: TAGS,
      body: fromZod(saveManualMealSchema),
      ok: ref('Meal'),
      okStatus: '201',
    }),
  },

  '/api/v1/meals/dates': {
    get: authed({
      operationId: 'listLoggedDates',
      summary: 'Dates that have any meal logged',
      description: 'Backs the calendar picker: which days have data to show.',
      tags: TAGS,
      parameters: [tzParam],
      ok: {
        type: 'array',
        items: { type: 'string', format: 'date' },
        description: '`YYYY-MM-DD`, ascending.',
      },
    }),
  },

  '/api/v1/meals/pending': {
    get: authed({
      operationId: 'listPendingMeals',
      summary: 'Analyses awaiting confirmation',
      description:
        'Meals that were analysed but never confirmed — the review cards a client restores after a reload or an app switch.',
      tags: TAGS,
      parameters: [dateParam, tzParam],
      ok: { type: 'array', items: ref('PendingMeal') },
    }),
  },

  '/api/v1/meals/pending/{analysisId}': {
    delete: authed({
      operationId: 'discardPendingMeal',
      summary: 'Discard an analysis awaiting confirmation',
      description:
        'Throws away a staged analysis the user decided against, so it stops appearing as a review card. Without this the only exits from a staged meal are confirming it or waiting out its 30-minute expiry.',
      tags: TAGS,
      parameters: [
        pathParam('analysisId', 'UUID of the pending analysis to discard.'),
      ],
      ok: ref('Acknowledgement'),
    }),
  },

  '/api/v1/meals/cheat-occasions': {
    get: authed({
      operationId: 'listCheatOccasions',
      summary: 'Recent cheat-mode occasions',
      description:
        'Past cheat-mode entries, most recent first, so one can be repeated without re-describing it.',
      tags: TAGS,
      parameters: [limitParam(12, 'How many occasions to return. Default 12.')],
      ok: { type: 'array', items: ref('RecentCheatOccasion') },
    }),
  },

  '/api/v1/meals/cheat-repeat': {
    post: authed({
      operationId: 'repeatCheatOccasion',
      summary: 'Repeat a cheat-mode entry',
      description:
        'Logs a previous cheat occasion again on a new date. For meals that cannot be itemised — a buffet, a barbecue, a box of pastries.',
      tags: TAGS,
      body: fromZod(cheatRepeatSchema),
      ok: ref('Meal'),
      okStatus: '201',
    }),
  },

  '/api/v1/meals/relog': {
    post: authed({
      operationId: 'relogMeals',
      summary: 'Re-log past dishes or meals',
      description:
        'Every entry is a reference, never a payload: no names, grams or nutrition cross the wire. The server re-resolves each reference against the caller’s own rows, so a stale or tampered client can only ever point at its own data.',
      tags: TAGS,
      body: fromZod(relogItemsSchema),
      ok: ref('Meal'),
      okStatus: '201',
    }),
  },

  '/api/v1/meals/relog/stage': {
    post: authed({
      operationId: 'stageRelog',
      summary: 'Stage a re-log for review',
      description:
        'Like `relogMeals`, but stages the picks as a pending analysis so they land in the same editable review card an AI-analysed meal does, instead of being written immediately. `attemptId` is required — it is the upsert key that stops repeated staging accumulating rows.',
      tags: TAGS,
      body: fromZod(stageRelogAnalysisSchema),
      ok: ref('StagedRelogAnalysis'),
      okDescription: 'The staged pending analysis.',
    }),
  },

  '/api/v1/meals/relog/candidates': {
    get: authed({
      operationId: 'searchRelogCandidates',
      summary: 'Search past dishes and meals to re-log',
      description:
        'Backs the slash-picker. An empty `q` returns the caller’s top dishes and meals by a frequency-and-recency score, so there is no separate "recents" endpoint. Queries are normalised to NFC because Vietnamese typed through Telex or VNI arrives decomposed.',
      tags: TAGS,
      parameters: [
        {
          name: 'q',
          in: 'query',
          required: false,
          description:
            'Search text. Empty or omitted returns the top candidates.',
          schema: { type: 'string', maxLength: 60 },
        },
        limitParam(12, 'How many candidates to return. Default 8.'),
      ],
      ok: ref('RelogCandidates'),
      okDescription: 'Matching dish and meal candidates.',
    }),
  },
};
