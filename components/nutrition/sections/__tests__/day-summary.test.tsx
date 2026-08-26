import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type {
  CalorieAverages,
  MacroPattern,
  NutritionDayScope,
  NutritionDaySeries,
} from '@/lib/domain/nutrition/types';
import enNutrition from '@/messages/en/nutrition.json';
import viNutrition from '@/messages/vi/nutrition.json';
import { DaySummary } from '../day-summary';

const averages: CalorieAverages = {
  all: { averagePerDay: 1400, days: 3 },
  complete: { averagePerDay: 1900, days: 2 },
};

const macros: MacroPattern[] = [];

const daySeries: NutritionDaySeries = {
  points: [],
  unit: 'day',
} as unknown as NutritionDaySeries;

function renderSummary(
  overrides: {
    scope?: NutritionDayScope;
    isEmpty?: boolean;
    selectedIndex?: number | null;
  } = {}
) {
  const {
    scope = 'complete',
    isEmpty = false,
    selectedIndex = null,
  } = overrides;
  return render(
    <DaySummary
      macros={macros}
      daySeries={daySeries}
      resolvedRange="1d"
      calorieAverages={averages}
      previousCalorieAverages={averages}
      scope={scope}
      onScopeChange={() => undefined}
      dateSpan="Apr 20 – Apr 26"
      isEmpty={isEmpty}
      todayIndex={0}
      selectedIndex={selectedIndex}
      onSelect={() => undefined}
    />
  );
}

// The hint names the rule behind the filtered figure, so it belongs only to
// the scope that actually applies it.
const hint = () => screen.queryByText(/rhythm\.completeDaysHint/);

describe('DaySummary complete-day hint', () => {
  it('explains the rule on the complete-day scope, naming the other scope', () => {
    renderSummary();

    expect(hint()).toBeInTheDocument();
  });

  // The global next-intl mock renders keys, not messages, so the wiring above
  // cannot show the label actually lands. Both locales carrying the
  // placeholder is what keeps the note and the scope switch from drifting.
  it.each([
    ['en', enNutrition],
    ['vi', viNutrition],
  ])('interpolates the all-days label in %s rather than restating it', (_locale, messages) => {
    expect(messages.rhythm.completeDaysHint).toContain('{allLabel}');
  });

  it('stays hidden on the all-days scope, which sets nothing aside', () => {
    renderSummary({ scope: 'all' });

    expect(hint()).not.toBeInTheDocument();
  });

  it('stays hidden while a single bucket is selected', () => {
    renderSummary({ selectedIndex: 2 });

    expect(hint()).not.toBeInTheDocument();
  });

  it('stays hidden when nothing is logged in the range', () => {
    renderSummary({ isEmpty: true });

    expect(hint()).not.toBeInTheDocument();
  });
});
