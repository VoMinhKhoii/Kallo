import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

// The panel is loaded through next/dynamic so react-day-picker stays out of the
// logging route's bundle. In jsdom that loader resolves on its own schedule,
// which turns every assertion below into a race, so swap it for the panel
// itself. What the split buys is a bundle claim, and the build output is what
// should prove it — not a timer in a unit test.
vi.mock('next/dynamic', async () => {
  const mod = await import('../timeline-calendar-panel');
  return { default: () => mod.TimelineCalendarPanel };
});

// Overrides the global next-intl mock, which pins useLocale to 'en'. The grid
// is formatted by date-fns inside DayPicker, not by next-intl, so the only way
// to see it localize is to drive the locale.
const { localeRef } = vi.hoisted(() => ({ localeRef: { current: 'en' } }));
vi.mock('next-intl', () => ({
  useTranslations: () =>
    Object.assign((key: string) => key, {
      rich: (key: string) => key,
      raw: (key: string) => key,
      has: () => false,
    }),
  useLocale: () => localeRef.current,
  useMessages: () => ({}),
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

const { TimelineCalendar } = await import('../timeline-calendar');
const { HAS_MEAL_MARKER_CLASS } = await import('../timeline-calendar-panel');

describe('TimelineCalendar', () => {
  const baseProps = {
    today: '2026-09-22',
    selectedDate: '2026-09-22',
    dailyKcal: new Map<string, number | null>([
      ['2026-09-16', 2014],
      ['2026-09-21', 1842],
    ]),
    onSelectDate: vi.fn(),
  };

  async function openCalendar() {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /openCalendar/i }));
    await screen.findByRole('grid');
    return user;
  }

  it('renders no month grid until the trigger is used', () => {
    render(<TimelineCalendar {...baseProps} />);

    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /openCalendar/i })
    ).toBeInTheDocument();
  });

  it('opens as a modal dialog carrying its own title and description', async () => {
    render(<TimelineCalendar {...baseProps} />);
    await openCalendar();

    const dialog = screen.getByRole('dialog');
    // The heading lives on the dialog, not the panel: Radix needs a Title and
    // a Description to label the modal, and duplicating them inside the grid
    // would announce the same words twice.
    expect(dialog).toHaveAccessibleName(/datePickerTitle/i);
    expect(dialog).toHaveAccessibleDescription(/datePickerDescription/i);
  });

  it('reports the clicked day as a YYYY-MM-DD string', async () => {
    const onSelectDate = vi.fn();
    render(<TimelineCalendar {...baseProps} onSelectDate={onSelectDate} />);
    const user = await openCalendar();

    await user.click(screen.getByRole('button', { name: /September 17/i }));

    // Not an ISO timestamp: everything downstream keys off the local calendar
    // day, and toISOString() would shift it for anyone east of UTC.
    expect(onSelectDate).toHaveBeenCalledWith('2026-09-17');
  });

  it('closes itself once a day is chosen', async () => {
    render(<TimelineCalendar {...baseProps} />);
    const user = await openCalendar();

    await user.click(screen.getByRole('button', { name: /September 17/i }));

    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('starts its week on Monday, like the tree above it', async () => {
    // getWeekStart and weekOfMonth both count from Monday, so a Sunday-first
    // grid would sit under "Week 4 · Sep 21 - Sep 27" showing a row that starts
    // on Sep 20.
    render(<TimelineCalendar {...baseProps} />);
    await openCalendar();

    const weekdays = Array.from(
      screen
        .getByRole('grid')
        .querySelectorAll('thead th, [role="columnheader"]')
    ).map((cell) => cell.textContent?.trim());

    expect(weekdays[0]).toMatch(/^Mo/);
    expect(weekdays.at(-1)).toMatch(/^Su/);
  });

  it('formats the grid in the active locale, not always English', async () => {
    // DayPicker renders month names, weekday headings and the day cells'
    // accessible labels from a date-fns locale of its own. Left unset, a
    // Vietnamese surface got an English calendar under a translated title.
    localeRef.current = 'en';
    const { unmount } = render(<TimelineCalendar {...baseProps} />);
    await openCalendar();
    const english = screen.getByRole('dialog').textContent;
    expect(english).toMatch(/September/i);
    unmount();

    localeRef.current = 'vi';
    render(<TimelineCalendar {...baseProps} />);
    await openCalendar();
    const vietnamese = screen.getByRole('dialog').textContent;

    expect(vietnamese).not.toMatch(/September/i);
    expect(vietnamese).not.toBe(english);
    localeRef.current = 'en';
  });

  it('gives the close button a translated label', async () => {
    // The shared dialog close hard-codes an English "Close" in its sr-only
    // text, which would sit inside an otherwise Vietnamese dialog.
    render(<TimelineCalendar {...baseProps} />);
    await openCalendar();

    // 'close' is the key; the global next-intl mock echoes keys back, so
    // seeing it proves the label comes from the message catalogue and not
    // from the hard-coded string in components/ui/dialog.tsx.
    const closers = screen
      .getAllByRole('button')
      .filter((b) => b.textContent === 'close');
    expect(closers).toHaveLength(1);
    expect(screen.queryByText('Close')).not.toBeInTheDocument();
  });

  it('disables days after today', async () => {
    render(<TimelineCalendar {...baseProps} />);
    await openCalendar();

    expect(
      screen.getByRole('button', { name: /September 23/i })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /September 21/i })
    ).not.toBeDisabled();
  });

  it('says in the accessible name which days hold a log', async () => {
    // The marker is a CSS `after:` dot, which is invisible to a screen reader.
    // Without this a nonvisual user has to open days one at a time to find the
    // ones with meals on them — the sidebar's own date buttons already name
    // their totals for the same reason.
    render(<TimelineCalendar {...baseProps} />);
    await openCalendar();

    expect(
      screen.getByRole('button', { name: /September 16.*hasMealIndicator/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /September 17.*hasMealIndicator/i })
    ).not.toBeInTheDocument();
  });

  it('marks the days that already hold a log', async () => {
    const { container } = render(<TimelineCalendar {...baseProps} />);
    await openCalendar();

    // A modifier arrives as a CLASS on the day cell, not an attribute, so the
    // marker is read off the cell that `data-day` identifies.
    const cellFor = (date: string) =>
      container.ownerDocument.querySelector(`td[data-day="${date}"]`);
    const marker = HAS_MEAL_MARKER_CLASS.split(' ')[0];

    expect(cellFor('2026-09-16')?.className).toContain(marker);
    expect(cellFor('2026-09-17')?.className).not.toContain(marker);
  });
});
