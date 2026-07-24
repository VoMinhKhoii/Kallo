// @vitest-environment jsdom
//
// Integration ("e2e-style") coverage for the save-meal feature. The confirm flow
// has many moving parts — an optimistic insert, a non-abortable server commit,
// and two independent calorie rings reading two different queries (the logging
// page's `useLoggingDay` and the dashboard's `useDailyMeals`). Regressions here
// are easy to introduce and invisible to the per-hook unit tests, so this drives
// the real hooks + a real QueryClient against a mutable in-memory "server" and
// asserts the rendered ring totals on BOTH surfaces, including reconciliation of
// the optimistic estimate to the saved value and the reload-pending path.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDailyMeals } from '@/hooks/meals/use-daily-meals';
import { useLoggingDay } from '@/hooks/meals/use-logging-day';
import { useConfirmMeal } from '@/hooks/meals/use-meal-mutations';
import type {
  LoggingDayData,
  PendingMealConfirmation,
  PersistedMeal,
} from '@/lib/actions/meals/types';
import { NUTRITION_KEYS } from '@/lib/ai/constants';
import type { ParsedMeal } from '@/lib/types/meal';

// ---------------------------------------------------------------------------
// In-memory server. confirmAndSaveMealAction moves a pending row into a saved
// meal whose nutrition is intentionally DIFFERENT from the optimistic estimate
// (mirrors server-side goal adjustment), so reconciliation is observable.
// ---------------------------------------------------------------------------

const SERVER_CALORIES = 480; // saved/goal-adjusted value the rings must settle on
const OPTIMISTIC_CALORIES = 500; // raw estimate from the streamed parsedMeal

const server = {
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

function nutritionWith(calories: number) {
  const base = Object.fromEntries(NUTRITION_KEYS.map((k) => [k, null]));
  return {
    ...base,
    caloriesKcal: calories,
    proteinG: 20,
    carbohydrateG: 40,
    fatG: 10,
  } as PersistedMeal['nutrition'];
}

const { mockLoadLoggingDay, mockLoadMealsByDate, mockConfirm } = vi.hoisted(
  () => ({
    mockLoadLoggingDay: vi.fn(),
    mockLoadMealsByDate: vi.fn(),
    mockConfirm: vi.fn(),
  })
);

vi.mock('@/lib/actions/meals/load-meals', () => ({
  loadLoggingDay: mockLoadLoggingDay,
  loadMealsByDate: mockLoadMealsByDate,
}));

vi.mock('@/lib/actions/meals/confirm-and-save', () => ({
  confirmAndSaveMealAction: mockConfirm,
}));

vi.mock('@/lib/actions/meals/mutate-meal', () => ({
  deleteMealAction: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const USER_ID = 'user-1';
const DATE = '2026-05-04';

function parsedMeal(): ParsedMeal {
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

// ---------------------------------------------------------------------------
// Test surfaces — minimal stand-ins for the two calorie rings + the confirm
// button. Each ring reads the same query its real ring reads and renders the
// summed calories; the button fires the real confirm mutation.
// ---------------------------------------------------------------------------

function caloriesOf(meals: PersistedMeal[]): number {
  return meals.reduce((sum, m) => sum + (m.nutrition.caloriesKcal ?? 0), 0);
}

function LoggingRing() {
  const { data } = useLoggingDay(USER_ID, DATE);
  return (
    <div data-testid="logging-ring">
      {caloriesOf(data?.persistedMeals ?? [])}
    </div>
  );
}

function DashboardRing() {
  const { data } = useDailyMeals(DATE);
  return <div data-testid="dashboard-ring">{caloriesOf(data ?? [])}</div>;
}

function ConfirmButton({
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

function Surfaces({
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

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false },
    },
  });
}

function renderWith(client: QueryClient, ui: ReactNode) {
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
}

async function clickConfirm() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));
  });
}

// A promise we resolve by hand, to hold a query's initial fetch unresolved
// across the confirm (simulating a first-load still in flight when the user
// saves) and release it afterwards.
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function savedMeal(id: string, calories: number): PersistedMeal {
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

beforeEach(() => {
  server.reset();
  vi.clearAllMocks();

  mockLoadLoggingDay.mockImplementation(
    async (): Promise<LoggingDayData> => ({
      persistedMeals: server.meals,
      pendingConfirmations: server.pending,
    })
  );
  mockLoadMealsByDate.mockImplementation(
    async (): Promise<PersistedMeal[]> => server.meals
  );
  // Commit: drop the confirmed pending row, APPEND the saved meal (keeping any
  // other meals/pendings), and return that authoritative meal in the response
  // (mirrors the real action, which the client reconciles against without a day
  // refetch). Edited dishes come back with adjusted (doubled) calories so the
  // edit path is observable end-to-end.
  mockConfirm.mockImplementation(
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
});

describe('save-meal flow (integration)', () => {
  it('first streamed meal: both rings reconcile to the saved server value', async () => {
    const client = makeClient();
    renderWith(client, <Surfaces />);

    // Both rings start empty.
    await waitFor(() => {
      expect(screen.getByTestId('logging-ring')).toHaveTextContent('0');
      expect(screen.getByTestId('dashboard-ring')).toHaveTextContent('0');
    });

    await clickConfirm();

    // After the confirm settles, BOTH rings reflect the SAVED value (480) — not
    // the optimistic estimate (500) and not the empty pre-save snapshot (0).
    await waitFor(() => {
      expect(screen.getByTestId('logging-ring')).toHaveTextContent(
        String(SERVER_CALORIES)
      );
      expect(screen.getByTestId('dashboard-ring')).toHaveTextContent(
        String(SERVER_CALORIES)
      );
    });
    expect(server.confirmCalls).toBe(1);
  });

  it('keeps the saved meal even if a stale empty day refetch races the confirm', async () => {
    const client = makeClient();
    renderWith(client, <Surfaces showDashboard={false} />);

    await waitFor(() =>
      expect(screen.getByTestId('logging-ring')).toHaveTextContent('0')
    );

    // Kick a manual refetch that resolves against the PRE-save snapshot, then
    // confirm. The settle cancel + re-fetch must make the saved meal the last
    // writer rather than letting the in-flight empty read clobber it.
    await act(async () => {
      void client.refetchQueries({ queryKey: ['logging-day'] });
      fireEvent.click(screen.getByRole('button', { name: 'confirm' }));
    });

    await waitFor(() =>
      expect(screen.getByTestId('logging-ring')).toHaveTextContent(
        String(SERVER_CALORIES)
      )
    );
  });

  it('refreshes the dashboard ring even when it was unmounted during the save', async () => {
    // Regression: the realistic flow is dashboard (cached empty) → logging → log
    // a meal → back to dashboard. Confirming while the dashboard is unmounted
    // must still mark its cached daily-meals query stale, so re-opening it shows
    // the meal instead of lingering on the empty (full) pre-save snapshot within
    // staleTime. Refetching only ACTIVE queries on settle would miss it.
    const client = makeClient();
    const { rerender } = renderWith(client, <Surfaces />);

    // 1. Dashboard mounts and caches the empty day.
    await waitFor(() =>
      expect(screen.getByTestId('dashboard-ring')).toHaveTextContent('0')
    );

    // 2. Leave the dashboard (query stays cached, not yet stale: DATE is a past
    //    day → 5min staleTime, and gcTime is Infinity here).
    rerender(
      <QueryClientProvider client={client}>
        <Surfaces showDashboard={false} />
      </QueryClientProvider>
    );
    expect(screen.queryByTestId('dashboard-ring')).toBeNull();

    // 3. Save the first meal from the logging page.
    await clickConfirm();
    await waitFor(() =>
      expect(screen.getByTestId('logging-ring')).toHaveTextContent(
        String(SERVER_CALORIES)
      )
    );

    // 4. Re-open the dashboard — it must refetch (because it was invalidated) and
    //    show the saved meal, not the stale cached 0.
    rerender(
      <QueryClientProvider client={client}>
        <Surfaces />
      </QueryClientProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId('dashboard-ring')).toHaveTextContent(
        String(SERVER_CALORIES)
      )
    );
  });

  it('reload-pending: confirming a server-loaded pending meal fills both rings', async () => {
    // Simulate a reload where the unsaved meal is a server pending row (it never
    // entered the local message list). Confirming it must save AND sync the rings.
    server.pending = [
      {
        id: 'analysis-1',
        rawInput: 'Phở bò',
        loggedAt: '2026-05-04T05:30:00.000Z',
        parsedMeal: parsedMeal(),
      },
    ];

    const client = makeClient();
    renderWith(client, <Surfaces />);

    // Pending isn't counted, so the rings start at 0 with a pending row present.
    await waitFor(() =>
      expect(screen.getByTestId('logging-ring')).toHaveTextContent('0')
    );

    await clickConfirm();

    await waitFor(() => {
      expect(screen.getByTestId('logging-ring')).toHaveTextContent(
        String(SERVER_CALORIES)
      );
      expect(screen.getByTestId('dashboard-ring')).toHaveTextContent(
        String(SERVER_CALORIES)
      );
    });
    expect(server.confirmCalls).toBe(1);
  });

  it('accumulates onto existing meals rather than replacing them', async () => {
    // A day that already has one saved meal (300). Saving a second must SUM both
    // on the ring (300 + 480 = 780), not overwrite — guards the merge appending.
    server.meals = [
      {
        id: 'meal-0',
        rawInput: 'Cơm tấm',
        mealSlot: null,
        confidenceOverall: null,
        loggedAt: '2026-05-04T03:00:00.000Z',
        nutrition: nutritionWith(300),
        mealItemGroups: [],
        entryMode: 'precise',
        alcoholG: null,
        cheatSliders: null,
        share: null,
      },
    ];

    const client = makeClient();
    renderWith(client, <Surfaces mealId="meal-1" />);

    await waitFor(() =>
      expect(screen.getByTestId('logging-ring')).toHaveTextContent('300')
    );

    await clickConfirm();

    await waitFor(() => {
      expect(screen.getByTestId('logging-ring')).toHaveTextContent('780');
      expect(screen.getByTestId('dashboard-ring')).toHaveTextContent('780');
    });
  });

  it('passes quantity edits to the server and shows the adjusted value', async () => {
    // A whole-dish edit must flow through to the server action, and the ring must
    // settle on the server's edit-adjusted value (doubled here), not the estimate.
    const client = makeClient();
    renderWith(
      client,
      <Surfaces edits={[{ mealItemOrder: 0, newGrams: 600 }]} />
    );

    await waitFor(() =>
      expect(screen.getByTestId('logging-ring')).toHaveTextContent('0')
    );

    await clickConfirm();

    await waitFor(() =>
      expect(screen.getByTestId('logging-ring')).toHaveTextContent(
        String(SERVER_CALORIES * 2)
      )
    );
    expect(server.lastEdits).toEqual([{ mealItemOrder: 0, newGrams: 600 }]);
  });

  it('rolls back the optimistic insert when the save fails', async () => {
    // A day with one saved meal (300). A confirm that the server rejects must
    // leave the ring at 300 — the optimistic insert is removed, no phantom meal.
    server.meals = [
      {
        id: 'meal-0',
        rawInput: 'Cơm tấm',
        mealSlot: null,
        confidenceOverall: null,
        loggedAt: '2026-05-04T03:00:00.000Z',
        nutrition: nutritionWith(300),
        mealItemGroups: [],
        entryMode: 'precise',
        alcoholG: null,
        cheatSliders: null,
        share: null,
      },
    ];
    mockConfirm.mockRejectedValueOnce(new Error('boom'));

    const client = makeClient();
    renderWith(client, <Surfaces mealId="meal-1" />);

    await waitFor(() =>
      expect(screen.getByTestId('logging-ring')).toHaveTextContent('300')
    );

    await clickConfirm();

    // The optimistic 780 must not stick; the ring returns to the prior 300.
    await waitFor(() =>
      expect(screen.getByTestId('logging-ring')).toHaveTextContent('300')
    );
    expect(screen.getByTestId('dashboard-ring')).toHaveTextContent('300');
  });

  it('confirming one of several pending meals leaves the others pending', async () => {
    // Two server pending rows; confirming one persists only it (counted on the
    // ring) and leaves the other pending (uncounted) — no cross-contamination.
    server.pending = [
      {
        id: 'analysis-1',
        rawInput: 'Phở bò',
        loggedAt: '2026-05-04T05:30:00.000Z',
        parsedMeal: parsedMeal(),
      },
      {
        id: 'analysis-2',
        rawInput: 'Bún chả',
        loggedAt: '2026-05-04T06:30:00.000Z',
        parsedMeal: parsedMeal(),
      },
    ];

    const client = makeClient();
    renderWith(client, <Surfaces analysisId="analysis-1" mealId="meal-1" />);

    await waitFor(() =>
      expect(screen.getByTestId('logging-ring')).toHaveTextContent('0')
    );

    await clickConfirm();

    await waitFor(() =>
      expect(screen.getByTestId('logging-ring')).toHaveTextContent(
        String(SERVER_CALORIES)
      )
    );
    // Exactly one meal saved; the other pending row remains unconfirmed.
    expect(server.meals).toHaveLength(1);
    expect(server.pending.map((p) => p.id)).toEqual(['analysis-2']);
  });

  it('first meal saved while the dashboard daily-meals initial fetch is still in flight → dashboard ring settles to the server calories', async () => {
    // The dashboard's daily-meals query is never touched by onMutate, so a cancel
    // of its in-flight first load leaves it with no data; upsertMealIntoList
    // no-ops on undefined and the success settle refetches nothing → the ring
    // used to stay empty. It must instead heal to the saved value.
    const daily = deferred<PersistedMeal[]>();
    let dailyCalls = 0;
    mockLoadMealsByDate.mockImplementation(async () => {
      dailyCalls += 1;
      // Hold ONLY the first load unresolved (across the confirm); any post-save
      // refetch reads the current server state.
      if (dailyCalls === 1) return daily.promise;
      return server.meals;
    });

    const client = makeClient();
    renderWith(client, <Surfaces />);

    // logging-day resolves empty; the dashboard's daily-meals load is still in
    // flight, so its ring has no data yet (renders 0).
    await waitFor(() =>
      expect(screen.getByTestId('logging-ring')).toHaveTextContent('0')
    );
    expect(screen.getByTestId('dashboard-ring')).toHaveTextContent('0');

    // Save the first meal while that initial dashboard fetch is unresolved.
    await clickConfirm();

    // Release the held pre-save fetch AFTER the confirm; its (empty) pre-save
    // result must not win — the ring must reflect the saved server value.
    await act(async () => {
      daily.resolve([]);
    });

    await waitFor(() =>
      expect(screen.getByTestId('dashboard-ring')).toHaveTextContent(
        String(SERVER_CALORIES)
      )
    );
  });

  it('meal saved while the logging-day initial fetch (holding an existing server meal) is still in flight → logging ring settles to BOTH meals total', async () => {
    // The day already has a saved meal (300) on the server, but its logging-day
    // first load is still in flight when the user confirms a second meal (480).
    // Cancelling that load and seeding only the new meal undercounts the ring
    // (480), dropping the never-loaded 300. It must heal to the true total 780.
    server.meals = [savedMeal('meal-0', 300)];
    const day = deferred<LoggingDayData>();
    let dayCalls = 0;
    mockLoadLoggingDay.mockImplementation(async () => {
      dayCalls += 1;
      if (dayCalls === 1) return day.promise;
      return {
        persistedMeals: server.meals,
        pendingConfirmations: server.pending,
      };
    });

    const client = makeClient();
    renderWith(client, <Surfaces showDashboard={false} mealId="meal-1" />);

    // The initial logging-day fetch is in flight → the ring has no data yet.
    await waitFor(() =>
      expect(screen.getByTestId('logging-ring')).toHaveTextContent('0')
    );

    await clickConfirm();

    // Release the held pre-save fetch (it saw only the existing meal-0); it must
    // neither clobber the save nor let the never-loaded meal-0 fall out.
    await act(async () => {
      day.resolve({
        persistedMeals: [savedMeal('meal-0', 300)],
        pendingConfirmations: [],
      });
    });

    await waitFor(() =>
      expect(screen.getByTestId('logging-ring')).toHaveTextContent('780')
    );
  });
});
