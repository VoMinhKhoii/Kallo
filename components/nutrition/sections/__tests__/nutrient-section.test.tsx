import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ openPaywall: vi.fn() }));

vi.mock('@/components/billing/premium-guard-provider', () => ({
  usePremiumGuard: () => ({ openPaywall: mocks.openPaywall }),
}));

import { NutrientSection } from '../nutrient-section';

describe('NutrientSection — locked', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the Premium surface state and sends Upgrade to /pricing', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <NutrientSection locked micronutrients={[]} moreNutrients={[]} />
    );

    // The global next-intl stub echoes keys.
    expect(screen.getByRole('heading', { name: 'title' })).toBeInTheDocument();
    expect(screen.getByText('subtitle')).toBeInTheDocument();
    // The Koboyo cast draws the nutrition/locked pose.
    expect(container.querySelector('svg')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'cta' }));
    // `openPaywall` is the guard's navigation to /pricing?from=…
    expect(mocks.openPaywall).toHaveBeenCalledTimes(1);
  });
});
