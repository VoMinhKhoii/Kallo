import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WizardShell } from './wizard-shell';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('@/lib/onboarding/actions', () => ({
  saveOnboardingScreen: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./screen-body-metrics', () => ({
  ScreenBodyMetrics: () => <div>Body Metrics &amp; Targets</div>,
}));

vi.mock('./screen-origin', () => ({
  ScreenOrigin: () => <div>Origin</div>,
}));

vi.mock('./screen-cooking', () => ({
  ScreenCooking: () => <div>Cooking Habits</div>,
}));

vi.mock('./step-indicator', () => ({
  StepIndicator: () => <div>Step Indicator</div>,
}));

describe('WizardShell', () => {
  it('uses a narrower dialog width on screen 3', () => {
    render(<WizardShell initialStep={3} initialProfile={null} />);

    expect(screen.getByRole('dialog')).toHaveClass('max-w-[58rem]');
    expect(screen.getByText('Cooking Habits')).toBeInTheDocument();
  });
});
