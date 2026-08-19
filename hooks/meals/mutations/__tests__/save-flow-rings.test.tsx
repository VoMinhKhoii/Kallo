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
//
// The in-flight-heal scenarios live in save-flow-inflight-heal.test.tsx.
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  installServerMocks,
  makeClient,
  nutritionWith,
  parsedMeal,
  renderWith,
  SERVER_CALORIES,
  Surfaces,
  server,
} from './save-flow-harness';

beforeEach(() => {
  vi.clearAllMocks();
  installServerMocks({ mockLoadLoggingDay, mockLoadMealsByDate, mockConfirm });
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
});
