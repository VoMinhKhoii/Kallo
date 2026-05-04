import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TimelineSidebar } from './timeline-sidebar';

describe('TimelineSidebar', () => {
  /**
   * Helper to find a button by its aria-controls attribute.
   * Necessary because multiple week buttons can have the same accessible name
   * with the next-intl mock.
   */
  function getButtonByControls(controls: string): HTMLButtonElement {
    const button = screen
      .getAllByRole('button')
      .find(
        (candidate) => candidate.getAttribute('aria-controls') === controls
      );
    expect(button).toBeInstanceOf(HTMLButtonElement);
    return button as HTMLButtonElement;
  }

  const baseProps = {
    dates: ['2026-05-03', '2026-05-01'],
    allDates: ['2026-05-03', '2026-05-02', '2026-05-01'],
    today: '2026-05-03',
    selectedDate: '2026-05-02',
    isPending: false,
    isError: false,
    onRetry: vi.fn(),
    onSelectDate: vi.fn(),
  };

  it('renders navigation with aria-label translation key navigationLabel', () => {
    render(<TimelineSidebar {...baseProps} />);

    const nav = screen.getByRole('navigation', {
      name: /navigationLabel/i,
    });
    expect(nav).toBeInTheDocument();
  });

  it('exposes aria-expanded="true" for month and week controls containing selected date', () => {
    render(<TimelineSidebar {...baseProps} />);

    // Find month button for May 2026 (05-2026)
    const monthButton = screen.getByRole('button', {
      name: /5\/2026/i,
    });
    expect(monthButton).toHaveAttribute('aria-expanded', 'true');

    // Find week button for week 1 of May 2026 by its aria-controls attribute
    const weekButton = getButtonByControls('week-05-2026-w1');
    expect(weekButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('calls onSelectDate with correct date when date button is clicked', async () => {
    const user = userEvent.setup();
    const onSelectDate = vi.fn();

    render(<TimelineSidebar {...baseProps} onSelectDate={onSelectDate} />);

    // Find date button for May 1 (2026-05-01) by its exact formatted label
    // formatDayLabel returns "Fri, May 1" for 2026-05-01
    const mayFirstButton = screen.getByRole('button', {
      name: 'Fri - May 1',
    });

    await user.click(mayFirstButton);
    expect(onSelectDate).toHaveBeenCalledWith('2026-05-01');
  });

  it('keeps selected date usable in error state and exposes retry button calling onRetry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const onSelectDate = vi.fn();

    render(
      <TimelineSidebar
        {...baseProps}
        isError={true}
        onRetry={onRetry}
        onSelectDate={onSelectDate}
      />
    );

    // Selected date should still be clickable
    const dateButtons = screen.getAllByRole('button');
    const selectedDateButton = dateButtons.find((btn) =>
      btn.getAttribute('aria-current')
    );
    expect(selectedDateButton).toBeInTheDocument();

    // Retry button should be present
    const retryButton = screen.getByRole('button', {
      name: /retryDates/i,
    });
    expect(retryButton).toBeInTheDocument();

    await user.click(retryButton);
    expect(onRetry).toHaveBeenCalled();

    // Selected date should still be clickable
    if (selectedDateButton) {
      await user.click(selectedDateButton);
      expect(onSelectDate).toHaveBeenCalled();
    }
  });

  it('renders skeleton UI in loading state', () => {
    render(<TimelineSidebar {...baseProps} isPending={true} />);

    // Check for skeleton elements
    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();

    // Skeleton should have loading visual indicators
    const skeletons = nav.querySelectorAll('[aria-busy="true"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders noPreviousMeals message when dates is empty while keeping selected date usable', () => {
    render(<TimelineSidebar {...baseProps} dates={[]} />);

    // Empty history message should appear
    const emptyMessage = screen.getByText(/noPreviousMeals/i);
    expect(emptyMessage).toBeInTheDocument();

    // Selected date should still be clickable
    const dateButtons = screen.getAllByRole('button');
    const selectedDateButton = dateButtons.find((btn) =>
      btn.getAttribute('aria-current')
    );
    expect(selectedDateButton).toBeInTheDocument();
  });

  it('uses raw dates list for meal indicators: logged date has data-has-meal="true", unlogged date has data-has-meal="false"', () => {
    render(<TimelineSidebar {...baseProps} />);

    // Find all date buttons
    const dateButtons = screen.getAllByRole('button');
    const dateButtonsWithMealData = dateButtons.filter((btn) =>
      btn.hasAttribute('data-has-meal')
    );

    // May 3 (2026-05-03) is today and in dates array
    const may3Button = dateButtonsWithMealData.find(
      (btn) =>
        btn.textContent?.includes('Sun - May 3') &&
        btn.dataset.hasMeal === 'true'
    );
    expect(may3Button).toBeInTheDocument();

    // May 2 (2026-05-02) is selected but not in dates array
    const may2Button = dateButtonsWithMealData.find(
      (btn) =>
        btn.getAttribute('aria-current') === 'date' &&
        btn.dataset.hasMeal === 'false'
    );
    expect(may2Button).toBeInTheDocument();

    // May 1 (2026-05-01) is in dates array
    const may1Button = dateButtonsWithMealData.find(
      (btn) =>
        btn.textContent?.includes('May 1') && btn.dataset.hasMeal === 'true'
    );
    expect(may1Button).toBeInTheDocument();
  });

  it('renders week date ranges and day labels in less-recent-first order', () => {
    render(<TimelineSidebar {...baseProps} />);

    const weekButton = getButtonByControls('week-05-2026-w1');
    // May 2026: week 1 = May 1–3 (days before the first Monday, May 4)
    expect(weekButton).toHaveTextContent('May 1 - May 3');

    const dateButtons = screen
      .getAllByRole('button')
      .filter((button) => button.hasAttribute('data-has-meal'));

    // Days are sorted ascending (less recent first).
    // May 3 is today so it gets the localized today suffix.
    expect(dateButtons.map((button) => button.textContent)).toEqual([
      'Fri - May 1',
      'Sat - May 2',
      'Sun - May 3 (todayLabel)',
    ]);
  });

  it('collapses the selected month when its toggle button is clicked', async () => {
    const user = userEvent.setup();

    render(<TimelineSidebar {...baseProps} />);

    // Find month button for May 2026 (05-2026)
    const monthButton = screen.getByRole('button', {
      name: /5\/2026/i,
    });

    // Initially expanded (contains selected date)
    expect(monthButton).toHaveAttribute('aria-expanded', 'true');

    // Click to collapse
    await user.click(monthButton);

    // Now collapsed
    expect(monthButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('collapses the selected week when its toggle button is clicked', async () => {
    const user = userEvent.setup();

    render(<TimelineSidebar {...baseProps} />);

    // Find week button for week 1 of May 2026 by aria-controls
    const weekButton = getButtonByControls('week-05-2026-w1');

    // Initially expanded (contains selected date)
    expect(weekButton).toHaveAttribute('aria-expanded', 'true');

    // Click to collapse
    await user.click(weekButton);

    // Now collapsed
    expect(weekButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('handles multiple weeks with ambiguous names correctly using aria-controls', () => {
    // Test data with dates spanning multiple weeks to prove selector is robust.
    // May 2026: week 1 = May 1–3, week 2 = May 4–10, week 3 = May 11–17, week 4 = May 18–24
    const multiWeekProps = {
      ...baseProps,
      dates: [
        '2026-05-24',
        '2026-05-20',
        '2026-05-14',
        '2026-05-10',
        '2026-05-03',
        '2026-05-01',
      ],
      allDates: [
        '2026-05-24',
        '2026-05-20',
        '2026-05-14',
        '2026-05-10',
        '2026-05-03',
        '2026-05-02',
        '2026-05-01',
      ],
      selectedDate: '2026-05-10',
    };

    render(<TimelineSidebar {...multiWeekProps} />);

    // All week buttons have the same accessible name "week" due to next-intl mock
    // but we can distinguish them by aria-controls

    // Week 1 (May 1–3)
    const week1Button = getButtonByControls('week-05-2026-w1');
    expect(week1Button).toHaveAttribute('aria-expanded', 'false'); // Not selected

    // Week 2 (May 4–10) - contains selected date (May 10)
    const week2Button = getButtonByControls('week-05-2026-w2');
    expect(week2Button).toHaveAttribute('aria-expanded', 'true'); // Selected

    // Week 3 (May 11–17)
    const week3Button = getButtonByControls('week-05-2026-w3');
    expect(week3Button).toHaveAttribute('aria-expanded', 'false'); // Not selected

    // Week 4 (May 18–24)
    const week4Button = getButtonByControls('week-05-2026-w4');
    expect(week4Button).toHaveAttribute('aria-expanded', 'false'); // Not selected

    // All buttons are distinct despite having the same accessible name
    expect(week1Button).not.toBe(week2Button);
    expect(week2Button).not.toBe(week3Button);
    expect(week3Button).not.toBe(week4Button);
  });
});
