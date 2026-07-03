import type { Metadata } from 'next';
import { LabHeader } from '@/components/landing-lab/header';
import { V1Derivation } from '@/components/landing-lab/v1/derivation';
import { V1Hero } from '@/components/landing-lab/v1/hero';
import { VariantSwitcher } from '@/components/landing-lab/variant-switcher';

export const metadata: Metadata = {
  title: 'Nhẩm — design lab · v1 reactive shader',
  robots: { index: false },
};

/**
 * Design-lab prototype v1: centered hero over a demo-reactive WebGL
 * silk field. Lab pages are throwaway comparison surfaces — hardcoded
 * EN copy, no auth wiring.
 */
export default function V1Page() {
  return (
    <div className="bg-[#FEFBF6]">
      <LabHeader />
      <main>
        <V1Hero />
        <V1Derivation />
      </main>
      <VariantSwitcher />
    </div>
  );
}
