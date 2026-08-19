// @vitest-environment jsdom
//
// The in-flight-heal half of the save-meal integration suite: what happens when
// a save lands while a day query's fetch is still running. These are the cases
// `reconcileSavedMeal` re-arms an active refetch for — cancelling a fetch that
// carried never-loaded server meals would otherwise leave the ring undercounting.
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoggingDayData, PersistedMeal } from '@/lib/actions/meals/types';

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

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import {
  clickConfirm,
  DualConfirm,
  deferred,
  installServerMocks,
  LoggingRing,
  makeClient,
  renderWith,
  SERVER_CALORIES,
  Surfaces,
  savedMeal,
  server,
} from './save-flow-harness';

beforeEach(() => {
  vi.clearAllMocks();
  installServerMocks({ mockLoadLoggingDay, mockLoadMealsByDate, mockConfirm });
});

describe('save-meal flow — in-flight heal (integration)', () => {
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

  it("two meals confirmed back-to-back while the logging-day initial load and the first save's heal are both in flight → ring keeps the never-loaded server meal", async () => {
    // The day already has a saved server meal (300) whose logging-day initial
    // load is held in flight. Confirm A (480): its onMutate cancels the initial
    // load (data undefined), seeds [A], and — undefined snapshot — arms a heal
    // refetch (held, call 2). Then confirm B (480) WHILE that heal is still in
    // flight: B's onMutate cancel kills the heal and reverts to the (now defined)
    // [A] data, so B's snapshot is defined. Without re-arming, B's onSuccess sees
    // defined live data + defined snapshot → skips the heal, silently dropping
    // the never-loaded meal-0. The ring must heal to all three (300+480+480=1260).
    server.meals = [savedMeal('meal-0', 300)];
    const initial = deferred<LoggingDayData>();
    const heal = deferred<LoggingDayData>();
    let dayCalls = 0;
    mockLoadLoggingDay.mockImplementation(async () => {
      dayCalls += 1;
      // call 1 = held initial load; call 2 = A's held heal; call 3+ = current
      // server state (B's re-armed heal reads all three meals).
      if (dayCalls === 1) return initial.promise;
      if (dayCalls === 2) return heal.promise;
      return {
        persistedMeals: server.meals,
        pendingConfirmations: server.pending,
      };
    });

    const client = makeClient();
    renderWith(
      client,
      <>
        <LoggingRing />
        <DualConfirm />
      </>
    );

    // The initial logging-day fetch is in flight → the ring has no data yet.
    await waitFor(() =>
      expect(screen.getByTestId('logging-ring')).toHaveTextContent('0')
    );

    // Confirm A — its heal refetch is issued and held (call 2).
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'confirm-a' }));
    });

    // Confirm B while A's heal is still unresolved.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'confirm-b' }));
    });

    // Release the held fetches; both were cancelled, so their results must not win.
    await act(async () => {
      initial.resolve({
        persistedMeals: [savedMeal('meal-0', 300)],
        pendingConfirmations: [],
      });
      heal.resolve({
        persistedMeals: server.meals,
        pendingConfirmations: [],
      });
    });

    await waitFor(() =>
      expect(screen.getByTestId('logging-ring')).toHaveTextContent('1260')
    );
  });
});
