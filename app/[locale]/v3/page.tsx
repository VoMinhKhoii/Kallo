import type { Metadata } from 'next';
import { LabHeader } from '@/components/landing-lab/header';
import { V3Hero } from '@/components/landing-lab/v3/hero';
import { VariantSwitcher } from '@/components/landing-lab/variant-switcher';

export const metadata: Metadata = {
  title: 'Nhẩm — design lab · v3 cuisine globe',
  robots: { index: false },
};

/**
 * Design-lab prototype v3: a two-screen scroll story over one pinned
 * ceramic globe — horizon arc behind the hero copy that morphs into a
 * full centered cuisine globe (hover a country, taste its kitchen). Lab
 * pages are throwaway comparison surfaces — hardcoded EN copy, no auth
 * wiring.
 */
export default function V3Page() {
  return (
    <div className="bg-[#FEFBF6]">
      <LabHeader />
      <main>
        <V3Hero />
      </main>
      <VariantSwitcher />
    </div>
  );
}
