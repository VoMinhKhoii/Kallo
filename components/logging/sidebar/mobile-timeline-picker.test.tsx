import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileTimelinePicker } from './mobile-timeline-picker';

describe('MobileTimelinePicker', () => {
  const defaultProps = {
    dates: ['2026-05-06', '2026-05-02', '2026-05-01'],
    today: '2026-05-06',
    selectedDate: '2026-05-06',
    isPending: false,
    isError: false,
    onRetry: vi.fn(),
    onSelectDate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function getDateButton(accessibleDate: string) {
    return screen.getByRole('button', {
      name: new RegExp(accessibleDate),
    });
  }

  it('renders selected date chip with meal indicator when date has saved meal', () => {
    render(<MobileTimelinePicker {...defaultProps} />);

    const chip = screen.getByLabelText('selectDate');
    expect(chip).toBeInTheDocument();
    expect(within(chip).getByText('Wed - May 6')).toBeInTheDocument();
    expect(screen.getByLabelText('hasMealIndicator')).toBeInTheDocument();
  });

  it('does not show meal indicator when selected date has no meal', () => {
    render(
      <MobileTimelinePicker
        {...defaultProps}
        selectedDate="2026-05-05"
        dates={['2026-05-06']}
      />
    );

    expect(screen.queryByLabelText('hasMealIndicator')).not.toBeInTheDocument();
  });

  it('opens with the selected date centered in the visible strip', async () => {
    const user = userEvent.setup();
    render(<MobileTimelinePicker {...defaultProps} />);

    await user.click(screen.getByLabelText('selectDate'));

    // Selected = today = 2026-05-06 → centered window spans May 3 to May 9
    expect(screen.getByTestId('mobile-week-slider')).toBeInTheDocument();
    expect(getDateButton('May 3, 2026')).toBeInTheDocument();
    expect(getDateButton('May 9, 2026')).toBeInTheDocument();
    expect(screen.getByLabelText('nextWeek')).toBeDisabled();
  });

  it('navigates seven days into the past with the previous chevron', async () => {
    const user = userEvent.setup();
    render(<MobileTimelinePicker {...defaultProps} />);

    await user.click(screen.getByLabelText('selectDate'));
    await user.click(screen.getByLabelText('previousWeek'));

    // Anchor 2026-05-06 → 2026-04-29; centered window April 26 to May 2.
    expect(getDateButton('April 26, 2026')).toBeInTheDocument();
    expect(getDateButton('May 2, 2026')).toBeInTheDocument();
    expect(screen.getByLabelText('nextWeek')).not.toBeDisabled();
  });

  it('can keep generating older windows beyond the logged meal date range', async () => {
    const user = userEvent.setup();
    render(<MobileTimelinePicker {...defaultProps} dates={['2026-05-06']} />);

    await user.click(screen.getByLabelText('selectDate'));
    await user.click(screen.getByLabelText('previousWeek'));
    await user.click(screen.getByLabelText('previousWeek'));

    // Two prev chevrons from anchor 2026-05-06 → 2026-04-22; window April 19 to April 25.
    expect(getDateButton('April 19, 2026')).toBeInTheDocument();
    expect(getDateButton('April 25, 2026')).toBeInTheDocument();
  });

  it('navigates back toward the current week with the next chevron', async () => {
    const user = userEvent.setup();
    render(<MobileTimelinePicker {...defaultProps} />);

    await user.click(screen.getByLabelText('selectDate'));
    await user.click(screen.getByLabelText('previousWeek'));

    expect(screen.getByLabelText('nextWeek')).not.toBeDisabled();

    await user.click(screen.getByLabelText('nextWeek'));

    expect(screen.getByLabelText('nextWeek')).toBeDisabled();
  });

  it('centers the selected date when it is older than today', async () => {
    const user = userEvent.setup();
    render(
      <MobileTimelinePicker
        {...defaultProps}
        selectedDate="2026-04-22"
        dates={['2026-05-06']}
      />
    );

    await user.click(screen.getByLabelText('selectDate'));

    // Centered on 2026-04-22 → window April 19 to April 25.
    expect(getDateButton('April 19, 2026')).toBeInTheDocument();
    expect(getDateButton('April 25, 2026')).toBeInTheDocument();
    expect(screen.getByLabelText('nextWeek')).not.toBeDisabled();
  });

  it('selects future days inside the visible window and collapses to the chip', async () => {
    const user = userEvent.setup();
    const onSelectDate = vi.fn();
    render(
      <MobileTimelinePicker {...defaultProps} onSelectDate={onSelectDate} />
    );

    await user.click(screen.getByLabelText('selectDate'));
    // May 9 is selected+3 (the right edge of the centered window from today=May 6).
    await user.click(getDateButton('May 9, 2026'));

    expect(onSelectDate).toHaveBeenCalledWith('2026-05-09');
    await waitFor(() =>
      expect(screen.queryByTestId('mobile-week-slider')).not.toBeInTheDocument()
    );
    expect(screen.getByLabelText('selectDate')).toBeInTheDocument();
  });

  it('does not call onSelectDate again when selecting the already selected day', async () => {
    const user = userEvent.setup();
    const onSelectDate = vi.fn();
    render(
      <MobileTimelinePicker {...defaultProps} onSelectDate={onSelectDate} />
    );

    await user.click(screen.getByLabelText('selectDate'));
    await user.click(getDateButton('May 6, 2026'));

    expect(onSelectDate).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByTestId('mobile-week-slider')).not.toBeInTheDocument()
    );
  });

  it('keeps only adjacent weeks in the slider DOM for deep past dates', async () => {
    const user = userEvent.setup();
    render(
      <MobileTimelinePicker
        {...defaultProps}
        today="2026-05-06"
        selectedDate="2020-01-01"
        dates={[]}
      />
    );

    await user.click(screen.getByLabelText('selectDate'));

    const slider = screen.getByTestId('mobile-week-slider');
    expect(slider.querySelectorAll('[data-week-start]')).toHaveLength(3);
    expect(slider.querySelectorAll('button')).toHaveLength(21);
    expect(getDateButton('January 1, 2020')).toHaveAttribute(
      'aria-current',
      'date'
    );
  });

  it('does not select or collapse when a horizontal swipe starts on a day', async () => {
    const user = userEvent.setup();
    const onSelectDate = vi.fn();
    render(
      <MobileTimelinePicker {...defaultProps} onSelectDate={onSelectDate} />
    );

    await user.click(screen.getByLabelText('selectDate'));

    const day = getDateButton('May 4, 2026');
    fireEvent.pointerDown(day, { clientX: 100 });
    fireEvent.pointerUp(day, { clientX: 180 });
    fireEvent.click(day);

    expect(onSelectDate).not.toHaveBeenCalled();
    expect(screen.getByTestId('mobile-week-slider')).toBeInTheDocument();
    expect(getDateButton('April 27, 2026')).toBeInTheDocument();
  });

  it('keeps inactive week buttons out of the tab order', async () => {
    const user = userEvent.setup();
    render(<MobileTimelinePicker {...defaultProps} />);

    await user.click(screen.getByLabelText('selectDate'));

    const slider = screen.getByTestId('mobile-week-slider');
    const selectedDay = getDateButton('May 6, 2026');
    const hiddenSlides = slider.querySelectorAll(
      '[data-week-start][aria-hidden="true"]'
    );

    expect(selectedDay).toHaveAttribute('aria-current', 'date');
    expect(hiddenSlides).toHaveLength(2);
    for (const hiddenSlide of hiddenSlides) {
      for (const button of within(hiddenSlide as HTMLElement).getAllByRole(
        'button',
        { hidden: true }
      )) {
        expect(button).toHaveAttribute('tabIndex', '-1');
      }
    }
  });

  it('renders loading skeleton when isPending is true', () => {
    render(<MobileTimelinePicker {...defaultProps} isPending={true} />);

    expect(screen.getByTestId('mobile-picker-skeleton')).toBeInTheDocument();
    expect(screen.queryByLabelText('selectDate')).not.toBeInTheDocument();
  });

  it('renders error banner below chip while keeping chip usable', () => {
    render(<MobileTimelinePicker {...defaultProps} isError={true} />);

    expect(screen.getByLabelText('selectDate')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-picker-error')).toHaveAttribute(
      'role',
      'alert'
    );
    expect(screen.getByText('failedToLoadDates')).toBeInTheDocument();
    expect(screen.getByLabelText('retryDates')).toBeInTheDocument();
  });

  it('allows opening the week slider in error state', async () => {
    const user = userEvent.setup();
    render(<MobileTimelinePicker {...defaultProps} isError={true} />);

    await user.click(screen.getByLabelText('selectDate'));

    expect(screen.getByTestId('mobile-week-slider')).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked in error state', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <MobileTimelinePicker
        {...defaultProps}
        isError={true}
        onRetry={onRetry}
      />
    );

    await user.click(screen.getByLabelText('retryDates'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('disables retry while dates are refetching', () => {
    render(
      <MobileTimelinePicker
        {...defaultProps}
        isError={true}
        isRetrying={true}
      />
    );

    expect(screen.getByLabelText('retryDates')).toBeDisabled();
    expect(screen.getByLabelText('retryDates')).toHaveAttribute(
      'aria-busy',
      'true'
    );
  });
});
