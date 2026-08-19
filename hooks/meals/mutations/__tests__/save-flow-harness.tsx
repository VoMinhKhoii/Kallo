// Shared harness for the save-flow integration tests in this folder.
//
// In-memory server + minimal stand-ins for the two calorie rings and the
// confirm button. Each ring reads the same query its real ring reads and
// renders the summed calories; the button fires the real confirm mutation.
// `vi.mock` calls stay in the test files — vitest hoists them per module —
// and each passes its own mock fns to `installServerMocks`.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Mock } from 'vitest';
import { useConfirmMeal } from '@/hooks/meals/mutations/use-confirm-meal';
import { useDailyMeals } from '@/hooks/meals/queries/use-daily-meals';
import { useLoggingDay } from '@/hooks/meals/queries/use-logging-day';
import type {
  LoggingDayData,
  PendingMealConfirmation,
  PersistedMeal,
} from '@/lib/actions/meals/types';
import { NUTRITION_KEYS } from '@/lib/ai/types/nutrition-values';
import type { ParsedMeal } from '@/lib/core/types/meal';

export const SERVER_CALORIES = 480; // saved/goal-adjusted value the rings must settle on
export const OPTIMISTIC_CALORIES = 500; // raw estimate from the streamed parsedMeal

export const USER_ID = 'user-1';
export const DATE = '2026-05-04';

// ---------------------------------------------------------------------------
// In-memory server. confirmAndSaveMealAction moves a pending row into a saved
// meal whose nutrition is intentionally DIFFERENT from the optimistic estimate
// (mirrors server-side goal adjustment), so reconciliation is observable.
// ---------------------------------------------------------------------------

export const server = {
  meals: [] as PersistedMeal[],
  pending: [] as PendingMealConfirmation[],
  confirmCalls: 0,
  lastEdits: undefined as unknown[] | undefined,
  reset() {
    this.meals = [];
    this.pending = [];
    this.confirmCalls = 0;
    this.lastEdits = undefined;
  },
};

export function nutritionWith(calories: number) {
  const base = Object.fromEntries(NUTRITION_KEYS.map((k) => [k, null]));
  return {
    ...base,
    caloriesKcal: calories,
    proteinG: 20,
    carbohydrateG: 40,
    fatG: 10,
  } as PersistedMeal['nutrition'];
}

export function parsedMeal(): ParsedMeal {
  return {
    mealName: 'Phở bò',
    items: [
      {
        id: 'item-1',
        name: 'Phở bò',
        quantity: 300,
        unit: 'g',
        macros: {
          calories: OPTIMISTIC_CALORIES,
          protein: 30,
          carbs: 50,
          fat: 12,
        },
      },
    ],
    totalMacros: {
      calories: OPTIMISTIC_CALORIES,
      protein: 30,
      carbs: 50,
      fat: 12,
    },
  };
}

export function caloriesOf(meals: PersistedMeal[]): number {
  return meals.reduce((sum, m) => sum + (m.nutrition.caloriesKcal ?? 0), 0);
}

export function LoggingRing() {
  const { data } = useLoggingDay(USER_ID, DATE);
  return (
    <div data-testid="logging-ring">
      {caloriesOf(data?.persistedMeals ?? [])}
    </div>
  );
}

export function DashboardRing() {
  const { data } = useDailyMeals(DATE);
  return <div data-testid="dashboard-ring">{caloriesOf(data ?? [])}</div>;
}

export function ConfirmButton({
  analysisId,
  mealId = 'meal-1',
  edits,
}: {
  analysisId: string;
  mealId?: string;
  edits?: { mealItemOrder: number; newGrams: number }[];
}) {
  const confirm = useConfirmMeal(USER_ID);
  return (
    <button
      type="button"
      onClick={() =>
        confirm.mutate({
          analysisId,
          mealId,
          originDate: DATE,
          parsedMeal: parsedMeal(),
          rawInput: 'Phở bò',
          loggedAt: '2026-05-04T05:30:00.000Z',
          edits,
        })
      }
    >
      confirm
    </button>
  );
}

export function Surfaces({
  analysisId = 'analysis-1',
  mealId = 'meal-1',
  edits,
  showLogging = true,
  showDashboard = true,
}: {
  analysisId?: string;
  mealId?: string;
  edits?: { mealItemOrder: number; newGrams: number }[];
  showLogging?: boolean;
  showDashboard?: boolean;
}) {
  return (
    <>
      {showLogging && <LoggingRing />}
      {showDashboard && <DashboardRing />}
      <ConfirmButton analysisId={analysisId} mealId={mealId} edits={edits} />
    </>
  );
}

// Two independent confirm buttons (mirrors two pending cards, each with its own
// useConfirmMeal), so the test can drive two sequential confirms — the second
// fired while the first save's heal refetch is still in flight.
export function DualConfirm() {
  const confirmA = useConfirmMeal(USER_ID);
  const confirmB = useConfirmMeal(USER_ID);
  return (
    <>
      <button
        type="button"
        onClick={() =>
          confirmA.mutate({
            analysisId: 'analysis-1',
            mealId: 'meal-1',
            originDate: DATE,
            parsedMeal: parsedMeal(),
            rawInput: 'Phở bò',
            loggedAt: '2026-05-04T05:30:00.000Z',
          })
        }
      >
        confirm-a
      </button>
      <button
        type="button"
        onClick={() =>
          confirmB.mutate({
            analysisId: 'analysis-2',
            mealId: 'meal-2',
            originDate: DATE,
            parsedMeal: parsedMeal(),
            rawInput: 'Bún chả',
            loggedAt: '2026-05-04T06:30:00.000Z',
          })
        }
      >
        confirm-b
      </button>
    </>
  );
}

export function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false },
    },
  });
}

export function renderWith(client: QueryClient, ui: ReactNode) {
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
}

export async function clickConfirm() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));
  });
}

// A promise we resolve by hand, to hold a query's initial fetch unresolved
// across the confirm (simulating a first-load still in flight when the user
// saves) and release it afterwards.
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

export function savedMeal(id: string, calories: number): PersistedMeal {
  return {
    id,
    rawInput: 'Cơm tấm',
    mealSlot: null,
    confidenceOverall: null,
    loggedAt: '2026-05-04T03:00:00.000Z',
    nutrition: nutritionWith(calories),
    mealItemGroups: [],
    entryMode: 'precise',
    alcoholG: null,
    cheatSliders: null,
    share: null,
  };
}

/**
 * Reset the in-memory server and wire the caller's hoisted mocks to it — the
 * shared `beforeEach` body of every save-flow test file.
 */
export function installServerMocks(mocks: {
  mockLoadLoggingDay: Mock;
  mockLoadMealsByDate: Mock;
  mockConfirm: Mock;
}) {
  server.reset();

  mocks.mockLoadLoggingDay.mockImplementation(
    async (): Promise<LoggingDayData> => ({
      persistedMeals: server.meals,
      pendingConfirmations: server.pending,
    })
  );
  mocks.mockLoadMealsByDate.mockImplementation(
    async (): Promise<PersistedMeal[]> => server.meals
  );
  // Commit: drop the confirmed pending row, APPEND the saved meal (keeping any
  // other meals/pendings), and return that authoritative meal in the response
  // (mirrors the real action, which the client reconciles against without a day
  // refetch). Edited dishes come back with adjusted (doubled) calories so the
  // edit path is observable end-to-end.
  mocks.mockConfirm.mockImplementation(
    async ({
      mealId,
      analysisId,
      edits,
    }: {
      mealId: string;
      analysisId: string;
      edits?: unknown[];
    }) => {
      server.confirmCalls += 1;
      server.lastEdits = edits;
      server.pending = server.pending.filter((p) => p.id !== analysisId);
      const calories =
        edits && edits.length > 0 ? SERVER_CALORIES * 2 : SERVER_CALORIES;
      const meal: PersistedMeal = {
        id: mealId,
        rawInput: 'Phở bò',
        mealSlot: null,
        confidenceOverall: null,
        loggedAt: '2026-05-04T05:30:00.000Z',
        nutrition: nutritionWith(calories),
        mealItemGroups: [],
        entryMode: 'precise',
        alcoholG: null,
        cheatSliders: null,
        share: null,
      };
      server.meals = [...server.meals, meal];
      return { mealId, meal };
    }
  );
}
