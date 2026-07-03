import type { Metadata } from 'next';
import { LabHeader } from '@/components/landing-lab/header';
import { V2Derivation } from '@/components/landing-lab/v2/derivation';
import { V2Hero } from '@/components/landing-lab/v2/hero';
import { VariantSwitcher } from '@/components/landing-lab/variant-switcher';

export const metadata: Metadata = {
  title: 'Nhẩm — design lab · v2 3D still-life',
  robots: { index: false },
};

/**
 * Design-lab prototype v2: centered hero beside a react-three-fiber
 * ceramic still-life that reacts to the demo. Lab pages are throwaway
 * comparison surfaces — hardcoded EN copy, no auth wiring.
 */
export default function V2Page() {
  return (
    <div className="bg-[#FEFBF6]">
      <LabHeader />
      <main>
        <V2Hero />
        <V2Derivation />
      </main>
      <VariantSwitcher />
    </div>
  );
}
