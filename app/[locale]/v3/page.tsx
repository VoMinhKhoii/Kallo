import type { Metadata } from 'next';
import { LabHeader } from '@/components/landing-lab/header';
import { V3Hero } from '@/components/landing-lab/v3/hero';

export const metadata: Metadata = {
  title: 'Nhẩm — design lab · v3 cuisine globe',
  robots: { index: false },
};

/**
 * The winning design-lab prototype: a scroll story over one pinned
 * ceramic globe — horizon arc behind the hero copy that morphs into a
 * full centered cuisine globe, tours the continents with their real
 * day/night, then frees the globe for hover exploration. Still a lab
 * surface — hardcoded EN copy, no auth wiring — until it replaces the
 * production landing page.
 */
export default function V3Page() {
  return (
    <div className="bg-nham-surface">
      <LabHeader />
      <main>
        <V3Hero />
      </main>
    </div>
  );
}
