import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { ButtonsSection } from '@/components/design-system/buttons-section';
import { ColorsSection } from '@/components/design-system/colors-section';
import { ElevationSection } from '@/components/design-system/elevation-section';
import { SpacingSection } from '@/components/design-system/spacing-section';
import { TypographySection } from '@/components/design-system/typography-section';

export const metadata: Metadata = {
  title: 'Nhẩm — design system foundations',
  robots: { index: false },
};

const TOC = [
  ['#typography', 'Typography'],
  ['#color', 'Color'],
  ['#spacing', 'Spacing'],
  ['#elevation', 'Elevation & shape'],
  ['#buttons', 'Buttons'],
] as const;

/**
 * Living style guide for the small stuff — typography ramp, spacing rhythm,
 * radii, warm shadows, and the button table — rendered by the exact tokens
 * production uses (app/globals.css + components/ui/button.tsx). Unlisted
 * and noindexed, like the design-lab routes. The full brand guide lives in
 * .agents/skills/nham-design/.
 */
export default async function DesignSystemPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-dvh bg-nham-surface">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <header>
          <p className="eyebrow">Nhẩm design system</p>
          <h1 className="mt-3 font-serif text-h1">
            The small stuff, <span className="italic-accent">codified</span>
          </h1>
          <p className="mt-4 max-w-2xl text-nham-text-muted leading-relaxed">
            Foundations for everything under the components: type, color,
            spacing, elevation, and buttons. Metrics are calibrated to
            Anthropic&rsquo;s design system — the type ramp, spacing rhythm,
            radii, and minimal-shadow philosophy — expressed entirely in
            Nhẩm&rsquo;s warm palette and faces. Each specimen renders from the
            live production tokens — if it looks right here, the utility names
            shown are the ones to use.
          </p>
          <nav className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
            {TOC.map(([href, label]) => (
              <a
                className="text-nham-text-soft text-sm underline-offset-4 hover:text-nham-text hover:underline"
                href={href}
                key={href}
              >
                {label}
              </a>
            ))}
          </nav>
        </header>

        <div className="mt-14 space-y-16">
          <TypographySection />
          <ColorsSection />
          <SpacingSection />
          <ElevationSection />
          <ButtonsSection />
        </div>

        <footer className="mt-16 border-nham-border/60 border-t pt-6">
          <p className="text-nham-stone text-xs leading-relaxed">
            Hard rules: sentence case everywhere · no emoji, Lucide only · Lora
            is never bold · no pure red or green · preserve Vietnamese
            diacritics · bounded estimates, never fake precision. Full guide:
            .agents/skills/nham-design/README.md
          </p>
        </footer>
      </div>
    </main>
  );
}
