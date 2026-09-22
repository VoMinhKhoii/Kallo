import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TimelineDateButton } from '../timeline-date-button';

describe('TimelineDateButton', () => {
  const baseProps = {
    date: '2026-09-16',
    label: 'Wed - Sep 16',
    isActive: false,
    variant: 'desktop' as const,
    onSelectDate: vi.fn(),
  };

  it('shows the day total, rounded, when the day has one', () => {
    render(<TimelineDateButton {...baseProps} hasMeal kcal={2014.4} />);

    expect(screen.getByText('2014')).toBeInTheDocument();
  });

  it('shows nothing at all on a day with no calorie data', () => {
    // Not an em dash and not a 0: an unlogged row is blank, so the totals read
    // as a column of numbers rather than a column of placeholders.
    render(<TimelineDateButton {...baseProps} kcal={null} />);

    const button = screen.getByRole('button');
    expect(button.textContent).toBe('Wed - Sep 16');
    expect(screen.queryByText('—')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows nothing when a logged day has meals but no calorie data', () => {
    render(<TimelineDateButton {...baseProps} hasMeal kcal={null} />);

    expect(screen.getByRole('button').textContent).toBe('Wed - Sep 16');
  });

  it('names the total in the accessible label so the row reads as one thing', () => {
    // The visible number is decoration for a screen reader — on its own it
    // would be announced as a bare "2014" after the date.
    render(<TimelineDateButton {...baseProps} hasMeal kcal={2014} />);

    expect(
      screen.getByRole('button', { name: /Wed - Sep 16.*2014 kcal/ })
    ).toBeInTheDocument();
  });

  it('never renders a total on the mobile strip', () => {
    // Mobile keeps its dot; a number would not fit the 4.5rem chip.
    render(
      <TimelineDateButton {...baseProps} variant="mobile" hasMeal kcal={2014} />
    );

    expect(screen.queryByText('2014')).not.toBeInTheDocument();
  });

  it('still marks a logged day when totals are absent entirely', () => {
    render(<TimelineDateButton {...baseProps} hasMeal />);

    expect(screen.getByRole('button')).toHaveAttribute('data-has-meal', 'true');
  });
});
