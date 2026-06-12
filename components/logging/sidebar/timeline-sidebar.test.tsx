import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TimelineSidebar } from './timeline-sidebar';

describe('TimelineSidebar (flat day list)', () => {
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

  it('renders navigation with the navigationLabel aria-label', () => {
    render(<TimelineSidebar {...baseProps} />);
    expect(
      screen.getByRole('navigation', { name: /navigationLabel/i })
    ).toBeInTheDocument();
  });

  it('renders one sticky month divider for the month', () => {
    render(<TimelineSidebar {...baseProps} />);
    // formatMonthDivider → "May 2026" (long month + year)
    expect(
      screen.getByRole('heading', { name: 'May 2026' })
    ).toBeInTheDocument();
  });

  it('lists days flat, most-recent-first under the month', () => {
    render(<TimelineSidebar {...baseProps} />);
    const dayButtons = screen
      .getAllByRole('button')
      .filter((button) => button.hasAttribute('data-has-meal'));
    expect(dayButtons.map((button) => button.textContent)).toEqual([
      'Sun - May 3 (todayLabel)',
      'Sat - May 2',
      'Fri - May 1',
    ]);
  });

  it('calls onSelectDate with the clicked date', async () => {
    const user = userEvent.setup();
    const onSelectDate = vi.fn();
    render(<TimelineSidebar {...baseProps} onSelectDate={onSelectDate} />);
    await user.click(screen.getByRole('button', { name: 'Fri - May 1' }));
    expect(onSelectDate).toHaveBeenCalledWith('2026-05-01');
  });

  it('ArrowLeft selects the next older day, ArrowRight the next newer day', async () => {
    const user = userEvent.setup();
    const onSelectDate = vi.fn();
    render(<TimelineSidebar {...baseProps} onSelectDate={onSelectDate} />);

    const nav = screen.getByRole('navigation', { name: /navigationLabel/i });
    nav.focus();
    // Selected = May 2. Older = May 1, newer = May 3.
    await user.keyboard('{ArrowLeft}');
    expect(onSelectDate).toHaveBeenLastCalledWith('2026-05-01');
    await user.keyboard('{ArrowRight}');
    expect(onSelectDate).toHaveBeenLastCalledWith('2026-05-03');
  });

  it('marks logged dates with data-has-meal="true" and unlogged with "false"', () => {
    render(<TimelineSidebar {...baseProps} />);
    const dayButtons = screen
      .getAllByRole('button')
      .filter((button) => button.hasAttribute('data-has-meal'));

    const may3 = dayButtons.find((b) => b.textContent?.includes('May 3'));
    const may2 = dayButtons.find(
      (b) => b.getAttribute('aria-current') === 'date'
    );
    const may1 = dayButtons.find((b) => b.textContent?.includes('May 1'));

    expect(may3?.dataset.hasMeal).toBe('true');
    expect(may2?.dataset.hasMeal).toBe('false'); // selected but not logged
    expect(may1?.dataset.hasMeal).toBe('true');
  });

  it('keeps the selected date usable and exposes retry in the error state', async () => {
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

    const selected = screen
      .getAllByRole('button')
      .find((btn) => btn.getAttribute('aria-current'));
    expect(selected).toBeInTheDocument();

    const retry = screen.getByRole('button', { name: /retryDates/i });
    await user.click(retry);
    expect(onRetry).toHaveBeenCalled();

    if (selected) {
      await user.click(selected);
      expect(onSelectDate).toHaveBeenCalled();
    }
  });

  it('renders skeleton UI in the loading state', () => {
    render(<TimelineSidebar {...baseProps} isPending={true} />);
    const nav = screen.getByRole('navigation');
    expect(nav.querySelectorAll('[aria-busy="true"]').length).toBeGreaterThan(
      0
    );
  });

  it('renders the noPreviousMeals message when dates is empty', () => {
    render(<TimelineSidebar {...baseProps} dates={[]} />);
    expect(screen.getByText(/noPreviousMeals/i)).toBeInTheDocument();
    const selected = screen
      .getAllByRole('button')
      .find((btn) => btn.getAttribute('aria-current'));
    expect(selected).toBeInTheDocument();
  });

  it('renders a divider per distinct month, newest-first', () => {
    render(
      <TimelineSidebar
        {...baseProps}
        dates={['2026-05-01', '2026-04-20']}
        allDates={['2026-05-01', '2026-04-20']}
        selectedDate="2026-05-01"
      />
    );
    const headings = screen.getAllByRole('heading');
    expect(headings.map((h) => h.textContent)).toEqual([
      'May 2026',
      'April 2026',
    ]);
  });
});
