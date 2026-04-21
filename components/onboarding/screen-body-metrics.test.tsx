import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScreenBodyMetrics } from './screen-body-metrics';

const baseDefaults = {
  biologicalSex: 'male' as const,
  weightKg: 70,
  heightCm: 175,
  age: 30,
  activityLevel: 'moderate' as const,
  aggression: 0.5,
  carbSplit: 'moderate_carb' as const,
  deficitOverride: null,
};

describe('ScreenBodyMetrics', () => {
  it('keeps maintenance compact by hiding the aggression control', () => {
    render(
      <ScreenBodyMetrics
        defaultValues={{ ...baseDefaults, goal: 'maintaining' }}
        onChange={vi.fn()}
      />
    );

    expect(
      screen.queryByText('bodyMetrics.aggression')
    ).not.toBeInTheDocument();
    expect(screen.getByText('bodyMetrics.macroSummary')).toBeInTheDocument();
  });

  it('still shows the aggression control for cutting goals', () => {
    render(
      <ScreenBodyMetrics
        defaultValues={{ ...baseDefaults, goal: 'cutting' }}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('bodyMetrics.aggression')).toBeInTheDocument();
  });
});
