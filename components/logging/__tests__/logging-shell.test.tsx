import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { LoggingProfile } from '@/lib/domain/logging/types';
import { LoggingShell } from '../logging-shell';

// Mock child components
vi.mock('@/components/logging/feed/feed-area', () => ({
  FeedArea: ({
    selectedDate,
    onInitialMealApplied,
  }: {
    selectedDate: string;
    onInitialMealApplied?: () => void;
  }) => (
    <div data-testid="feed-area">
      <div data-testid="feed-selected-date">{selectedDate}</div>
      {onInitialMealApplied && (
        <button
          type="button"
          data-testid="apply-prefill-btn"
          onClick={() => onInitialMealApplied()}
        >
          Apply Prefill
        </button>
      )}
    </div>
  ),
}));

// The billing surfaces pull next-intl + entitlements; the shell only mounts
// them, so stub them out to keep this test focused on date/timeline behavior.
vi.mock('@/components/billing/subscription/trial-banner', () => ({
  TrialBanner: () => <div data-testid="trial-banner" />,
}));

vi.mock('@/components/billing/paywall/paywall-dialog', () => ({
  PaywallDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="paywall-dialog" /> : null,
}));

vi.mock('@/components/logging/sidebar/timeline-sidebar', () => ({
  TimelineSidebar: ({
    selectedDate,
    onSelectDate,
  }: {
    selectedDate: string;
    onSelectDate: (date: string) => void;
  }) => (
    <div data-testid="timeline-sidebar">
      <div data-testid="sidebar-selected-date">{selectedDate}</div>
      <button
        type="button"
        data-testid="sidebar-select-btn"
        onClick={() => onSelectDate('2026-05-01')}
      >
        Select Date
      </button>
    </div>
  ),
}));

vi.mock('@/components/logging/sidebar/mobile-timeline-picker', () => ({
  MobileTimelinePicker: ({
    selectedDate,
    onSelectDate,
    dates,
    allDates,
  }: {
    selectedDate: string;
    onSelectDate: (date: string) => void;
    dates: string[];
    allDates: string[];
  }) => (
    <div data-testid="mobile-timeline-picker">
      <div data-testid="mobile-selected-date">{selectedDate}</div>
      <div data-testid="mobile-dates">{dates.join(',')}</div>
      <div data-testid="mobile-all-dates">{allDates.join(',')}</div>
      <button
        type="button"
        data-testid="mobile-select-btn"
        onClick={() => onSelectDate('2026-05-02')}
      >
        Select Date Mobile
      </button>
    </div>
  ),
}));

// Mock actions
vi.mock('@/lib/actions/meals/load-meals', () => ({
  loadMealDates: vi.fn(),
}));

// Mock hooks
vi.mock('@/hooks/meals/queries/use-prefetch-dates', () => ({
  usePrefetchDates: vi.fn(),
}));

// Mock router hooks
const mockReplace = vi.fn();
const mockSearchParams = new Map<string, string>();

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key) ?? null,
    toString: () => {
      const params = new URLSearchParams();
      for (const [key, value] of mockSearchParams.entries()) {
        params.set(key, value);
      }
      return params.toString();
    },
  }),
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/logging',
}));

const { loadMealDates } = await import('@/lib/actions/meals/load-meals');
const { usePrefetchDates } = await import(
  '@/hooks/meals/queries/use-prefetch-dates'
);

const mockLoadMealDates = loadMealDates as Mock;
const mockUsePrefetchDates = usePrefetchDates as Mock;

describe('LoggingShell', () => {
  let queryClient: QueryClient;
  const mockProfile: LoggingProfile = {
    userId: 'user-123',
    goal: 'cutting',
    aggression: 0.5,
    calorieTarget: 2000,
    proteinTargetG: 150,
    carbsTargetG: 200,
    fatTargetG: 65,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.clear();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    // Default mock implementations
    mockLoadMealDates.mockResolvedValue([
      '2026-05-01',
      '2026-05-02',
      '2026-05-03',
    ]);
    mockUsePrefetchDates.mockReturnValue(undefined);
  });

  function renderShell(
    props: {
      profile?: LoggingProfile;
      initialMeal?: string;
      initialDate?: string;
    } = {}
  ) {
    return render(
      <QueryClientProvider client={queryClient}>
        <LoggingShell
          profile={props.profile ?? mockProfile}
          initialMeal={props.initialMeal}
          initialDate={props.initialDate}
        />
      </QueryClientProvider>
    );
  }

  it('initializes selectedDate from initialDate and renders timeline controls', async () => {
    renderShell({ initialDate: '2026-05-03' });

    await waitFor(() => {
      expect(screen.getByTestId('timeline-sidebar')).toBeInTheDocument();
    });

    expect(screen.getByTestId('sidebar-selected-date')).toHaveTextContent(
      '2026-05-03'
    );
    expect(screen.getByTestId('mobile-selected-date')).toHaveTextContent(
      '2026-05-03'
    );
    expect(screen.getByTestId('mobile-timeline-picker')).toBeInTheDocument();
    expect(screen.getByTestId('feed-area')).toBeInTheDocument();
  });

  it('passes one shared date state to mobile and desktop timeline controls', async () => {
    renderShell({ initialDate: '2026-05-03' });

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-selected-date')).toBeInTheDocument();
    });

    const sidebarDate = screen.getByTestId('sidebar-selected-date').textContent;
    const mobileDate = screen.getByTestId('mobile-selected-date').textContent;

    expect(sidebarDate).toBe('2026-05-03');
    expect(mobileDate).toBe('2026-05-03');
    expect(sidebarDate).toBe(mobileDate);

    await waitFor(() => {
      expect(screen.getByTestId('mobile-dates')).toHaveTextContent(
        '2026-05-01,2026-05-02,2026-05-03'
      );
    });
    expect(screen.getByTestId('mobile-all-dates')).toHaveTextContent(
      '2026-05-03'
    );
  });

  it('updates ?date= with router.replace and scroll false when date changes', async () => {
    const user = userEvent.setup();
    renderShell({ initialDate: '2026-05-03' });

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-select-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('sidebar-select-btn'));

    expect(mockReplace).toHaveBeenCalledWith('/logging?date=2026-05-01', {
      scroll: false,
    });
  });

  it('keeps the clicked date selected while router.replace catches up', async () => {
    const user = userEvent.setup();
    mockSearchParams.set('date', '2026-05-03');

    renderShell({ initialDate: '2026-05-03' });

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-select-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('sidebar-select-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-selected-date')).toHaveTextContent(
        '2026-05-01'
      );
      expect(screen.getByTestId('feed-selected-date')).toHaveTextContent(
        '2026-05-01'
      );
    });
  });

  it('updates ?date= when mobile picker selects a date', async () => {
    const user = userEvent.setup();
    renderShell({ initialDate: '2026-05-03' });

    await waitFor(() => {
      expect(screen.getByTestId('mobile-select-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('mobile-select-btn'));

    expect(mockReplace).toHaveBeenCalledWith('/logging?date=2026-05-02', {
      scroll: false,
    });
  });

  it('does not clear ?meal= until FeedArea reports the prefill was applied', async () => {
    mockSearchParams.set('meal', 'pho');
    mockSearchParams.set('date', '2026-05-03');

    renderShell({ initialMeal: 'pho', initialDate: '2026-05-03' });

    await waitFor(() => {
      expect(screen.getByTestId('feed-area')).toBeInTheDocument();
    });

    // Initial render should not clear meal param
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('clears ?meal= after prefill while preserving ?date=', async () => {
    const user = userEvent.setup();
    mockSearchParams.set('meal', 'pho');
    mockSearchParams.set('date', '2026-05-03');

    renderShell({ initialMeal: 'pho', initialDate: '2026-05-03' });

    await waitFor(() => {
      expect(screen.getByTestId('apply-prefill-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('apply-prefill-btn'));

    expect(mockReplace).toHaveBeenCalledWith('/logging?date=2026-05-03', {
      scroll: false,
    });
    expect(mockReplace).not.toHaveBeenCalledWith(
      expect.stringContaining('meal='),
      expect.anything()
    );
  });

  it('reconciles selectedDate when searchParams date changes externally', async () => {
    mockSearchParams.set('date', '2026-05-03');

    const { rerender } = renderShell({ initialDate: '2026-05-01' });

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-selected-date')).toHaveTextContent(
        '2026-05-03'
      );
    });

    // Simulate external URL change (e.g., browser back/forward)
    mockSearchParams.set('date', '2026-05-05');

    rerender(
      <QueryClientProvider client={queryClient}>
        <LoggingShell profile={mockProfile} initialDate="2026-05-01" />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-selected-date')).toHaveTextContent(
        '2026-05-05'
      );
    });
  });

  it('does not trigger state changes when URL date matches current selectedDate', async () => {
    mockSearchParams.set('date', '2026-05-03');

    const { rerender } = renderShell({ initialDate: '2026-05-03' });

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-selected-date')).toHaveTextContent(
        '2026-05-03'
      );
    });

    const initialSidebarElement = screen.getByTestId('sidebar-selected-date');

    // Re-render with same URL date - should not cause state update
    rerender(
      <QueryClientProvider client={queryClient}>
        <LoggingShell profile={mockProfile} initialDate="2026-05-03" />
      </QueryClientProvider>
    );

    // selectedDate should remain the same
    expect(screen.getByTestId('sidebar-selected-date')).toHaveTextContent(
      '2026-05-03'
    );
    expect(screen.getByTestId('sidebar-selected-date')).toBe(
      initialSidebarElement
    );
  });
});
