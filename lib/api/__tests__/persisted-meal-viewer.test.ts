import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NULL_NUTRITION_VALUES } from '@/lib/ai/__fixtures__/test-helpers';
import {
  NUTRITION_KEYS,
  type NutritionValues,
} from '@/lib/ai/types/nutrition-values';
import { buildBarcodeMealItem } from '@/lib/domain/barcode/meal-item';
import {
  friendships,
  mealItems,
  meals,
  pendingAnalyses,
  vietnameseFoodComposition,
} from '@/lib/infra/db/schema';

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
  gate: vi.fn(),
  resolve: vi.fn(),
}));
vi.mock('@/lib/infra/db/client', () => {
  const tx = {
    select: mocks.select,
    insert: mocks.insert,
    delete: mocks.remove,
    update: mocks.update,
  };
  return {
    db: { ...tx, transaction: (work: (tx: unknown) => unknown) => work(tx) },
  };
});
vi.mock('@/lib/infra/auth/session', () => ({
  requireAuthAndProfile: async () => ({
    user: { id: 'viewer' },
    profile: { goal: 'maintaining', aggression: null },
  }),
}));
vi.mock('@/lib/domain/billing/feature-gate', () => ({
  checkFeatureGate: mocks.gate,
  assertFeatureAccess: vi.fn(),
}));
vi.mock('@/lib/actions/meals/cheat/confirm', () => ({
  assertCheatConfirmAllowed: vi.fn(),
}));
vi.mock('@/lib/actions/meals/insert-default-share', () => ({
  insertDefaultCircleShare: async () => null,
}));
vi.mock('@/lib/actions/meals/day/reap-abandoned', () => ({
  reapAbandonedPendingAnalyses: async () => ({
    reapedIds: [],
    releasedInvites: false,
  }),
}));
vi.mock('@/lib/domain/barcode/service', () => ({
  stageBarcodeMeal: async () => ({
    analysisId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  }),
}));
vi.mock('@/lib/domain/nutrition/ocr/stage', () => ({
  stageOcrMeal: async () => ({
    analysisId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  }),
}));
vi.mock('@/lib/domain/nutrition/label-images/label-images', () => ({
  linkLabelImageToMeal: vi.fn(),
}));
vi.mock('@/lib/domain/onboarding/actions', () => ({
  getOnboardingProfile: async () => null,
}));
vi.mock('@/lib/actions/tracking/dashboard', () => ({
  loadCalorieAdherenceHeatmap: async () => [],
}));
vi.mock('@/lib/actions/tracking/weight', () => ({
  loadWeightSummaryAction: async () => null,
}));
vi.mock('@/lib/actions/meals/relog/resolve-sources', () => ({
  resolveRelogSources: mocks.resolve,
}));
vi.mock('@/lib/infra/rate-limit/limiter/limiter', () => ({
  withRateLimit: async (_policy: unknown, _key: unknown, work: () => unknown) =>
    work(),
}));
vi.mock('@/lib/domain/notifications/with-notifications', () => ({
  withNotifications: (
    db: { transaction: (fn: (tx: unknown) => unknown) => unknown },
    work: (tx: unknown, notify: () => Promise<void>) => unknown
  ) => db.transaction((tx) => work(tx, async () => {})),
}));
vi.mock('@/lib/domain/notifications/notify', () => ({
  closeAggregates: vi.fn(),
}));
vi.mock('@/lib/domain/social/shares/share-visibility', () => ({
  canViewShare: async () => true,
}));
vi.mock('@/lib/actions/meal-sharing/invite-lifecycle', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  claimPendingInvite: async () => ({
    invite: { fromUserId: ID },
    source,
    copyFactor: 1,
  }),
  bindInviteToMeal: vi.fn(),
}));

import { POST as barcode } from '@/app/api/v1/barcode/log/route';
import { GET as dashboard } from '@/app/api/v1/dashboard/route';
import { POST as accept } from '@/app/api/v1/groups/invites/accept/route';
import { POST as split } from '@/app/api/v1/groups/meal-share/route';
import { POST as copy } from '@/app/api/v1/groups/shares/log/route';
import { GET as day } from '@/app/api/v1/logging/day/route';
import { POST as duplicate } from '@/app/api/v1/meals/[mealId]/duplicate/route';
import { PATCH as edit } from '@/app/api/v1/meals/[mealId]/route';
import { POST as confirm } from '@/app/api/v1/meals/confirm/route';
import { POST as manual } from '@/app/api/v1/meals/manual/route';
import { POST as relog } from '@/app/api/v1/meals/relog/route';
import { GET as list } from '@/app/api/v1/meals/route';
import { POST as label } from '@/app/api/v1/nutrition-label/log/route';
import type { PersistedMeal } from '@/lib/actions/meals/types';

const ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const nutrition: NutritionValues = { ...NULL_NUTRITION_VALUES };
for (const key of NUTRITION_KEYS) nutrition[key] = 10;
const source = {
  ...nutrition,
  id: ID,
  userId: 'viewer',
  namePrimary: 'Sữa',
  barcodeDataVersion: 3,
  servingSizeG: null,
  packageSizeG: null,
  amountUnit: 'g',
  imageUrl: null,
  rawInput: 'Sữa',
  loggedAt: new Date('2026-11-01T12:00:00Z'),
  entryMode: 'precise',
  portionFactor: 1,
};
const ingredient = {
  ...nutrition,
  id: ID,
  mealId: ID,
  ingredientName: 'Sữa',
  mealItemName: 'Sữa',
  mealItemOrder: 0,
  estimatedGrams: 100,
  foodCompositionId: ID,
};
const { item, nutrition: displayedNutrition } = buildBarcodeMealItem(
  source,
  100
);
const pending = {
  id: ID,
  rawInput: 'Sữa',
  loggedAt: source.loggedAt,
  pipelineResult: {
    mealItems: [item],
    mealSlot: null,
    confidenceOverall: 'high',
    unmatchedIngredients: [],
    displayedNutrition,
    boundedNutrition: item.boundedNutrition,
  },
};

// A thenable query lets the real actions exercise their own select/insert paths.
function query(rows: unknown[]) {
  const result = Object.assign(Promise.resolve(rows), {
    where: () => result,
    orderBy: () => result,
    limit: () => result,
    for: () => result,
    returning: () => result,
    innerJoin: () => result,
    onConflictDoUpdate: () => result,
  });
  return result;
}

const writes: { table: unknown; values: unknown }[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  writes.length = 0;
  mocks.select.mockImplementation(() => ({
    from: (table: unknown) =>
      query(
        table === meals
          ? [source]
          : table === mealItems
            ? [ingredient]
            : table === pendingAnalyses
              ? [pending]
              : table === vietnameseFoodComposition
                ? [source]
                : table === friendships
                  ? [{ userLow: 'viewer', userHigh: ID }]
                  : []
      ),
  }));
  mocks.remove.mockImplementation(() => query([pending]));
  mocks.insert.mockImplementation((table: unknown) => ({
    values: (values: unknown) => {
      writes.push({ table, values });
      return query([{ id: ID }]);
    },
  }));
  mocks.update.mockImplementation((table: unknown) => ({
    set: (values: unknown) => {
      writes.push({ table, values });
      return query([]);
    },
  }));
  mocks.resolve.mockResolvedValue({
    dishes: [{ name: 'Sữa', rows: [ingredient] }],
    sourceConfidences: ['high'],
  });
});

const date = { loggedDate: '2026-11-01', timezoneOffset: 0 };
const params = { params: Promise.resolve({ mealId: ID }) };
function request(path: string, body?: unknown, method = 'POST') {
  return new NextRequest(
    `http://localhost/api/v1/${path}?date=2026-11-01&tz=0`,
    body === undefined
      ? undefined
      : {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
  );
}

const cases = [
  {
    name: 'barcode/log',
    call: () =>
      barcode(
        request('barcode/log', {
          ...date,
          barcode: '8934588012345',
          grams: 100,
        })
      ),
  },
  {
    name: 'meals/manual',
    call: () =>
      manual(
        request('meals/manual', {
          ...date,
          items: [{ foodCompositionId: ID, grams: 100 }],
        })
      ),
  },
  {
    name: 'meals/confirm',
    call: () => confirm(request('meals/confirm', { analysisId: ID })),
  },
  {
    name: 'nutrition-label/log',
    call: () =>
      label(
        request('nutrition-label/log', {
          ...date,
          productName: 'Sữa',
          amount: 100,
          unit: 'g',
          confidence: 'high',
          calories: 10,
          proteinGrams: 10,
          carbsGrams: 10,
          fatGrams: 10,
        })
      ),
  },
  {
    name: 'meals/[mealId]',
    call: () =>
      edit(
        request(`meals/${ID}`, { edits: [{ id: ID, newGrams: 100 }] }, 'PATCH'),
        params
      ),
  },
  {
    name: 'meals/[mealId]/duplicate',
    call: () => duplicate(request(`meals/${ID}/duplicate`, date), params),
  },
  {
    name: 'meals/relog',
    call: () =>
      relog(
        request('meals/relog', {
          ...date,
          items: [{ kind: 'meal', sourceMealId: ID }],
        })
      ),
  },
  {
    name: 'groups/invites/accept',
    call: () =>
      accept(request('groups/invites/accept', { ...date, inviteId: ID })),
  },
  {
    name: 'groups/shares/log',
    call: () =>
      copy(request('groups/shares/log', { ...date, shareId: ID, factor: 1 })),
  },
  {
    name: 'groups/meal-share',
    call: () =>
      split(
        request('groups/meal-share', {
          mealId: ID,
          friendUserIds: [ID],
          mode: 'split',
        })
      ),
    factor: 0.5,
  },
  { name: 'meals', call: () => list(request('meals')), shape: 'list' },
  {
    name: 'logging/day',
    call: () => day(request('logging/day')),
    shape: 'day',
  },
  {
    name: 'dashboard',
    call: () => dashboard(request('dashboard')),
    shape: 'dashboard',
  },
];

describe.each([
  false,
  true,
])('persisted meal REST responses (locked=%s)', (locked) => {
  it.each(
    cases
  )('$name scopes every nutrient level, keeping writes complete', async ({
    call,
    shape,
    factor = 1,
  }) => {
    mocks.gate.mockResolvedValue({ locked });
    const response = await call();
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    const meal: PersistedMeal =
      shape === 'list'
        ? body[0]
        : shape === 'day'
          ? body.persistedMeals[0]
          : shape === 'dashboard'
            ? body.day.persistedMeals[0]
            : body.meal;
    for (const values of [
      meal.nutrition,
      meal.mealItemGroups[0].nutrition,
      meal.mealItemGroups[0].ingredients[0].nutrition,
    ]) {
      for (const key of NUTRITION_KEYS) {
        const macro = [
          'caloriesKcal',
          'proteinG',
          'carbohydrateG',
          'fatG',
        ].includes(key);
        expect(values[key], key).toBe(locked && !macro ? null : 10 * factor);
      }
    }
    expect(mocks.gate).toHaveBeenCalledExactlyOnceWith(
      { userId: 'viewer' },
      'micronutrients'
    );
    for (const write of writes) {
      for (const row of Array.isArray(write.values)
        ? write.values
        : [write.values]) {
        if (row.sodiumMg !== undefined) expect(row.sodiumMg).toBe(10 * factor);
        if (row.fiberG !== undefined) expect(row.fiberG).toBe(10 * factor);
      }
    }
    const staged =
      shape === 'day'
        ? body.pendingConfirmations
        : shape === 'dashboard'
          ? body.day.pendingConfirmations
          : [];
    for (const card of staged) {
      expect(Object.keys(card.parsedMeal.totalMacros).sort()).toEqual([
        'calories',
        'carbs',
        'fat',
        'protein',
      ]);
      expect(Object.keys(card.parsedMeal.items[0].macros).sort()).toEqual([
        'calories',
        'carbs',
        'fat',
        'protein',
      ]);
    }
  });
});
