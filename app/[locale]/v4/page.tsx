import type { Metadata } from 'next';
import { LabHeader } from '@/components/landing-lab/header';
import { V4Derivation } from '@/components/landing-lab/v4/derivation';
import { V4Hero } from '@/components/landing-lab/v4/hero';
import { VariantSwitcher } from '@/components/landing-lab/variant-switcher';

export const metadata: Metadata = {
  title: 'Nhẩm — design lab · v4 editorial dark',
  robots: { index: false },
};

/**
 * Design-lab prototype v4: the espresso-dark museum catalog — pure
 * typography and hairlines, no canvas. Lab pages are throwaway
 * comparison surfaces — hardcoded EN copy, no auth wiring.
 */
export default function V4Page() {
  return (
    <div className="bg-[#2C2416]">
      <LabHeader tone="dark" />
      <main>
        <V4Hero />
        <V4Derivation />
      </main>
      <VariantSwitcher />
    </div>
  );
}
