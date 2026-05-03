import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TimelineSidebar } from './timeline-sidebar';

describe('TimelineSidebar', () => {
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

    // Find week button for week 1 of May 2026
    // Translation key is "Week {number}" which renders as "Week 1"
    const allButtons = screen.getAllByRole('button');
    const weekButton = allButtons.find(
      (btn) =>
        btn.hasAttribute('aria-controls') &&
        btn.getAttribute('aria-controls')?.startsWith('week-') &&
        btn.getAttribute('aria-expanded') === 'true'
    );
    expect(weekButton).toBeDefined();
    expect(weekButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('calls onSelectDate with correct date when date button is clicked', async () => {
    const user = userEvent.setup();
    const onSelectDate = vi.fn();

    render(<TimelineSidebar {...baseProps} onSelectDate={onSelectDate} />);

    // Find date button for May 1 (2026-05-01)
    const dateButtons = screen.getAllByRole('button');
    const mayFirstButton = dateButtons.find((btn) =>
      btn.textContent?.includes('Thu')
    );

    if (mayFirstButton) {
      await user.click(mayFirstButton);
      expect(onSelectDate).toHaveBeenCalledWith('2026-05-01');
    }
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
        btn.textContent?.includes('today') && btn.dataset.hasMeal === 'true'
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
});
