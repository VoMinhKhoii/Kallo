import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

const { buildMealDateIndex } = await import(
  '@/lib/domain/logging/meal-date-index'
);
const { TimelineCalendar } = await import('../timeline-calendar');

describe('TimelineCalendar', () => {
  const baseProps = {
    today: '2026-09-22',
    selectedDate: '2026-09-22',
    mealDates: buildMealDateIndex([
      { date: '2026-09-16', kcal: 2014 },
      { date: '2026-09-21', kcal: 1100 },
      { date: '2026-09-19', kcal: null },
    ]),
    calorieTarget: 2000,
    onSelectDate: vi.fn(),
  };

  // The locale is module-level state, so a test that FAILS before its own
  // cleanup line would leak Vietnamese into every test after it. Resetting
  // here runs whether the test passed or threw.
  afterEach(() => {
    localeRef.current = 'en';
  });

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

    // Three letters, not DayPicker's default two: "Mon", never "Mo".
    expect(weekdays[0]).toBe('Mon');
    expect(weekdays.at(-1)).toBe('Sun');
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
    // A numbered month, as the rest of the app writes it — not "Tháng Chín".
    expect(vietnamese).toMatch(/Tháng 9, 2026/);
    expect(vietnamese).not.toMatch(/Tháng Chín/i);
  });

  it('localizes the labels DayPicker writes itself, not just the dates', async () => {
    // The grid formatting above comes from date-fns. But DayPicker has a
    // SECOND layer of strings of its own — the month-nav buttons, and the
    // "Today, …" / "…, selected" wrappers on each day button. A bare date-fns
    // locale carries none of them, so a Vietnamese user got Vietnamese dates
    // inside English scaffolding. They live on react-day-picker's OWN locale
    // objects, which extend the date-fns ones with a `labels` bag.
    //
    // And `getLabels` resolves a CUSTOM label ahead of the locale's, so the
    // hasMeal override suppresses the localized day-button label outright
    // unless it delegates to it — which is why both halves are asserted here.
    localeRef.current = 'vi';
    render(<TimelineCalendar {...baseProps} />);
    await openCalendar();

    // Nav: nothing overrides these, so they prove the locale's `labels` bag is
    // reaching DayPicker at all.
    expect(
      screen.getByRole('button', { name: /tháng trước/i })
    ).toBeInTheDocument();
    // Day buttons: the override has to compose over the locale's wrapper, not
    // replace it. Sep 22 is the selected day.
    expect(
      screen.getByRole('button', { name: /đã chọn/i })
    ).toBeInTheDocument();
    // …while still appending our own indicator on the days that hold a log.
    // Named by its Vietnamese date, which is the point: the indicator has to
    // ride ON the localized label rather than replace it.
    expect(
      screen.getByRole('button', {
        name: /16 tháng 09.*hasMealIndicator/i,
      })
    ).toBeInTheDocument();
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

  it("names the day's calories against the target, and whether it was met", async () => {
    // The ring is an SVG a screen reader cannot read, so its numbers ride in
    // the button's name. 2014 of 2000 clears the 85% floor; 1100 does not.
    render(<TimelineCalendar {...baseProps} />);
    await openCalendar();

    expect(
      screen.getByRole('button', {
        name: /September 16.*calendarDayKcal.*targetMet/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /September 21.*calendarDayKcal.*belowTarget/i,
      })
    ).toBeInTheDocument();
    // A day holding a log with no known total says it holds one, and invents
    // no progress for it.
    const unknown = screen.getByRole('button', {
      name: /September 19.*hasMealIndicator/i,
    });
    expect(unknown).not.toHaveAccessibleName(/calendarDayKcal/i);
  });

  it('rings each past day green once it clears the floor, ink below it', async () => {
    render(<TimelineCalendar {...baseProps} />);
    await openCalendar();

    const progressOf = (name: RegExp) =>
      screen.getByRole('button', { name }).getAttribute('data-progress');

    expect(progressOf(/September 16/i)).toBe('met');
    expect(progressOf(/September 21/i)).toBe('below');
    // Unknown total and an empty day: a bare track, no arc.
    expect(progressOf(/September 19/i)).toBeNull();
    expect(progressOf(/September 17/i)).toBeNull();
  });

  it('draws no ring on days that have not happened yet', async () => {
    render(<TimelineCalendar {...baseProps} />);
    await openCalendar();

    const future = screen.getByRole('button', { name: /September 23/i });
    const past = screen.getByRole('button', { name: /September 17/i });
    expect(future.querySelector('svg')).toBeNull();
    expect(past.querySelector('svg')).not.toBeNull();
  });

  it("hides the neighbouring months' days", async () => {
    render(<TimelineCalendar {...baseProps} />);
    await openCalendar();

    // September 2026 opens on a Tuesday, so a Monday-first grid would lead
    // with August 31 if outside days were shown.
    expect(
      screen.queryByRole('button', { name: /August 31/i })
    ).not.toBeInTheDocument();
  });

  it('jumps to today from the footer and closes', async () => {
    const onSelectDate = vi.fn();
    render(
      <TimelineCalendar
        {...baseProps}
        selectedDate="2026-09-10"
        onSelectDate={onSelectDate}
      />
    );
    const user = await openCalendar();

    await user.click(screen.getByRole('button', { name: 'todayLabel' }));

    expect(onSelectDate).toHaveBeenCalledWith('2026-09-22');
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });
});
