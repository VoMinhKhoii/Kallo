import type { Metadata } from 'next';
import { LabHeader } from '@/components/landing-lab/header';
import { V3Derivation } from '@/components/landing-lab/v3/derivation';
import { V3Hero } from '@/components/landing-lab/v3/hero';
import { VariantSwitcher } from '@/components/landing-lab/variant-switcher';

export const metadata: Metadata = {
  title: 'Nhẩm — design lab · v3 kinetic type',
  robots: { index: false },
};

/**
 * Design-lab prototype v3: centered hero inside a depth-layered field of
 * world dish names that converges when the demo derives. Lab pages are
 * throwaway comparison surfaces — hardcoded EN copy, no auth wiring.
 */
export default function V3Page() {
  return (
    <div className="bg-[#FEFBF6]">
      <LabHeader />
      <main>
        <V3Hero />
        <V3Derivation />
      </main>
      <VariantSwitcher />
    </div>
  );
}
