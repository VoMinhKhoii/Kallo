import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Package } from '@/lib/domain/billing/web-purchases';
import { PackageCard } from '../package-card';

// next-intl is stubbed globally to echo keys, so assertions read as the copy
// key the card chose — which is exactly what this regression is about.
function paddlePackage(identifier: string): Package {
  return {
    identifier: `pkg_${identifier}`,
    webBillingProduct: {
      identifier,
      price: { formattedPrice: '₫99.000' },
    },
  } as unknown as Package;
}

function renderCard(identifier: string) {
  render(
    <PackageCard
      anyPending={false}
      onSelect={vi.fn()}
      pending={false}
      rcPackage={paddlePackage(identifier)}
    />
  );
}

describe('PackageCard plan labelling', () => {
  it('labels the canonical ids Apple and Google report', () => {
    renderCard('kallo_premium_annual');
    expect(screen.getByText('planAnnual')).toBeInTheDocument();
    expect(screen.getByText('cadenceYear')).toBeInTheDocument();
  });

  // A Paddle-backed offering reports opaque price ids. Comparing them against
  // the canonical names matches nothing, so every plan fell through to the
  // monthly branch — annual lost its "best value" ribbon and lifetime read as
  // a recurring charge at the lifetime price.
  it('labels the Paddle price id for annual, not monthly', () => {
    renderCard('pri_01kyy258p8ay94vzvyznz6k9r0');
    expect(screen.getByText('planAnnual')).toBeInTheDocument();
    expect(screen.getByText('cadenceYear')).toBeInTheDocument();
    expect(screen.queryByText('cadenceMonth')).not.toBeInTheDocument();
  });

  it('labels the Paddle price id for lifetime as a one-time buy', () => {
    renderCard('pri_01kyy26yps3tt1zf1vjhhcvkp8');
    expect(screen.getByText('planLifetime')).toBeInTheDocument();
    expect(screen.getByText('cadenceOnce')).toBeInTheDocument();
    expect(screen.queryByText('cadenceMonth')).not.toBeInTheDocument();
  });

  it('still labels the Paddle monthly price id as monthly', () => {
    renderCard('pri_01kyy23rh7qjch1798kfwqx8x8');
    expect(screen.getByText('planMonthly')).toBeInTheDocument();
    expect(screen.getByText('cadenceMonth')).toBeInTheDocument();
  });
});
