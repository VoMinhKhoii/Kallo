import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MobileTimelineRail } from './mobile-timeline-rail';

describe('MobileTimelineRail', () => {
  const defaultProps = {
    dates: ['2026-05-03', '2026-05-02', '2026-05-01'],
    allDates: [
      '2026-05-03',
      '2026-05-02',
      '2026-05-01',
      '2026-04-30',
      '2026-04-29',
    ],
    mobileDates: ['2026-05-03', '2026-05-02', '2026-05-01'],
    hasHiddenDates: true,
    today: '2026-05-03',
    selectedDate: '2026-05-03',
    isPending: false,
    isError: false,
    onRetry: vi.fn(),
    onSelectDate: vi.fn(),
  };

  it('marks selected date with aria-current="date" and calls onSelectDate when another date is clicked', async () => {
    const user = userEvent.setup();
    const onSelectDate = vi.fn();

    render(
      <MobileTimelineRail {...defaultProps} onSelectDate={onSelectDate} />
    );

    // Selected date has aria-current="date"
    const selectedButton = screen.getByRole('button', {
      current: 'date',
    });
    expect(selectedButton).toBeInTheDocument();

    // Click another date
    const otherDateButtons = screen.getAllByRole('button');
    const anotherDate = otherDateButtons.find(
      (btn) => btn.getAttribute('aria-current') !== 'date'
    );

    if (anotherDate) {
      await user.click(anotherDate);
      expect(onSelectDate).toHaveBeenCalled();
    }
  });

  it('opens older history inline when hidden dates exist', async () => {
    const user = userEvent.setup();

    render(<MobileTimelineRail {...defaultProps} />);

    // Find history toggle button
    const historyToggle = screen.getByRole('button', {
      name: /history/i,
    });

    // Initially collapsed
    expect(historyToggle).toHaveAttribute('aria-expanded', 'false');
    expect(historyToggle).toHaveAttribute(
      'aria-controls',
      'mobile-timeline-history'
    );

    // Click to expand
    await user.click(historyToggle);

    // Now expanded
    expect(historyToggle).toHaveAttribute('aria-expanded', 'true');

    // History nav is visible
    const historyNav = screen.getByRole('navigation', {
      name: /historyNavigationLabel/i,
    });
    expect(historyNav).toBeVisible();

    // A hidden older date is visible
    const olderDateButton = screen.getByRole('button', { name: /apr 30/i });
    expect(olderDateButton).toBeInTheDocument();
  });

  it('closes older history after selecting a date from the panel', async () => {
    const user = userEvent.setup();
    const onSelectDate = vi.fn();

    render(
      <MobileTimelineRail {...defaultProps} onSelectDate={onSelectDate} />
    );

    // Open history
    const historyToggle = screen.getByRole('button', {
      name: /history/i,
    });
    await user.click(historyToggle);

    // Verify expanded
    expect(historyToggle).toHaveAttribute('aria-expanded', 'true');

    // Select a date from history panel
    const olderDateButton = screen.getByRole('button', { name: /apr 30/i });
    await user.click(olderDateButton);

    // History should close
    expect(historyToggle).toHaveAttribute('aria-expanded', 'false');

    // onSelectDate should have been called
    expect(onSelectDate).toHaveBeenCalledWith('2026-04-30');
  });

  it('uses data-has-meal based on raw dates list from loadMealDates', () => {
    render(<MobileTimelineRail {...defaultProps} />);

    // Find button with date that is in dates (use compact format: "3 Sun")
    const loggedButton = screen.getByRole('button', {
      name: /3 sun/i,
    });
    expect(loggedButton).toHaveAttribute('data-has-meal', 'true');

    // If selected date is not in dates, it should not have meal
    const propsWithoutMeal = {
      ...defaultProps,
      dates: ['2026-05-02', '2026-05-01'],
      selectedDate: '2026-05-03',
    };

    const { container } = render(<MobileTimelineRail {...propsWithoutMeal} />);
    const selectedWithoutMeal = container.querySelector(
      '[aria-current="date"]'
    );
    expect(selectedWithoutMeal).toHaveAttribute('data-has-meal', 'false');
  });

  it('renders empty history state explaining no previous meals', () => {
    const emptyProps = {
      ...defaultProps,
      dates: [],
      allDates: ['2026-05-03'],
      mobileDates: ['2026-05-03'],
      hasHiddenDates: false,
    };

    render(<MobileTimelineRail {...emptyProps} />);

    // Today/selected date should be selectable
    const todayButton = screen.getByRole('button', {
      current: 'date',
    });
    expect(todayButton).toBeInTheDocument();

    // No previous meals message
    const noPreviousMealsText = screen.getByText(/noPreviousMeals/i);
    expect(noPreviousMealsText).toBeInTheDocument();
  });

  it('renders loading state with skeleton chips', () => {
    const loadingProps = {
      ...defaultProps,
      isPending: true,
    };

    render(<MobileTimelineRail {...loadingProps} />);

    const skeleton = screen.getByTestId('mobile-timeline-skeleton');
    expect(skeleton).toBeInTheDocument();
  });

  it('renders error state with retry button', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    const errorProps = {
      ...defaultProps,
      isError: true,
      onRetry,
    };

    render(<MobileTimelineRail {...errorProps} />);

    // Local dates should still be visible
    const todayButton = screen.getByRole('button', {
      current: 'date',
    });
    expect(todayButton).toBeInTheDocument();

    // Error message should be visible
    const errorMessage = screen.getByText(/failedToLoadDates/i);
    expect(errorMessage).toBeInTheDocument();

    // Retry button
    const retryButton = screen.getByRole('button', {
      name: /retryDates/i,
    });
    await user.click(retryButton);

    expect(onRetry).toHaveBeenCalled();
  });
});
