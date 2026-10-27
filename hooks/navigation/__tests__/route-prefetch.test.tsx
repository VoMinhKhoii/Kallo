import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const meals = vi.hoisted(() => ({
  fetchMealsByDate: vi.fn(async () => []),
  fetchLoggingDay: vi.fn(async () => ({ releasedInvites: false })),
  fetchMealDateSummaries: vi.fn(async () => []),
}));
const dashboard = vi.hoisted(() => ({
  fetchWeightSummary: vi.fn(async () => ({})),
}));
// The overview's query options call its fetcher inside the same module, so
// the request is observed one layer down.
const http = vi.hoisted(() => ({ request: vi.fn(async () => ({})) }));

vi.mock('@/lib/domain/meals/meals-client', () => meals);
vi.mock('@/lib/domain/dashboard/dashboard-client', () => dashboard);
vi.mock('@/lib/api/client-fetch', () => http);

const { RoutePrefetchProvider, useNavIntent } = await import(
  '@/hooks/navigation/route-prefetch'
);

function NavLink({ href }: { href: string }) {
  return (
    <a href={href} {...useNavIntent(href)}>
      {href}
    </a>
  );
}

function renderNav(userId: string | undefined) {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <RoutePrefetchProvider userId={userId}>
        <NavLink href="/dashboard" />
        <NavLink href="/logging" />
        <NavLink href="/nutrition" />
        <NavLink href="/circle" />
      </RoutePrefetchProvider>
    </QueryClientProvider>
  );
}

const allFetchers = () => [
  ...Object.values(meals),
  ...Object.values(dashboard),
  ...Object.values(http),
];

beforeEach(() => {
  for (const fn of allFetchers()) fn.mockClear();
});

describe('nav intent prefetch', () => {
  it('loads the dashboard reads when the pointer reaches its link', async () => {
    renderNav('user-1');
    fireEvent.pointerEnter(screen.getByText('/dashboard'));

    await vi.waitFor(() => {
      expect(meals.fetchMealsByDate).toHaveBeenCalledTimes(1);
      expect(dashboard.fetchWeightSummary).toHaveBeenCalledWith(
        expect.objectContaining({ range: '30d' })
      );
    });
  });

  it('loads the logging day and timeline on focus', async () => {
    renderNav('user-1');
    fireEvent.focus(screen.getByText('/logging'));

    await vi.waitFor(() => {
      expect(meals.fetchLoggingDay).toHaveBeenCalledTimes(1);
      expect(meals.fetchMealDateSummaries).toHaveBeenCalledTimes(1);
    });
  });

  it('loads the nutrition overview on a touch', async () => {
    renderNav('user-1');
    fireEvent.touchStart(screen.getByText('/nutrition'));

    await vi.waitFor(() =>
      expect(http.request).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\/api\/v1\/nutrition\/overview\?range=auto&days=complete/
        )
      )
    );
  });

  it('does not refetch while the prefetched data is fresh', async () => {
    renderNav('user-1');
    const link = screen.getByText('/dashboard');
    fireEvent.pointerEnter(link);
    await vi.waitFor(() =>
      expect(meals.fetchMealsByDate).toHaveBeenCalledTimes(1)
    );

    fireEvent.pointerEnter(link);
    fireEvent.focus(link);
    await Promise.resolve();
    expect(meals.fetchMealsByDate).toHaveBeenCalledTimes(1);
  });

  it('prefetches nothing for other tabs or without a signed-in profile', async () => {
    renderNav('user-1');
    fireEvent.pointerEnter(screen.getByText('/circle'));
    renderNav(undefined);
    for (const link of screen.getAllByText('/dashboard')) {
      fireEvent.pointerEnter(link);
    }
    await Promise.resolve();

    // Only the signed-in render's dashboard hover fetched.
    expect(meals.fetchMealsByDate).toHaveBeenCalledTimes(1);
    expect(meals.fetchLoggingDay).not.toHaveBeenCalled();
  });
});
