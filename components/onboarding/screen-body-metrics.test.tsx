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

    expect(screen.queryByText('Pace & Aggression')).not.toBeInTheDocument();
    expect(screen.getByText('Daily Target & Macros')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /moderate carb/i })
    ).toBeInTheDocument();
  });

  it('still shows the aggression control for cutting goals', () => {
    render(
      <ScreenBodyMetrics
        defaultValues={{ ...baseDefaults, goal: 'cutting' }}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('Pace & Aggression')).toBeInTheDocument();
  });
});
