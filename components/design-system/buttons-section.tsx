import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DsCard, DsMeta, DsSection } from './specimen';

const APP_VARIANTS = [
  'default',
  'secondary',
  'outline',
  'ghost',
  'destructive',
  'link',
] as const;

export function ButtonsSection() {
  return (
    <DsSection
      accent="warm by default"
      eyebrow="Buttons"
      id="buttons"
      intro="Every variant resolves through tokens — the default button is warm umber (never black), destructive is terracotta (never pure red), and the focus ring is tan (never blue). Hover only darkens by one step; no scaling, no movement (hero CTAs excepted). Labels are sentence case; icons sit beside the label with an 8px gap, never instead of it. On touch screens every button carries an invisible 40px minimum hit area."
      title="One table,"
    >
      <DsCard title="App variants × sizes">
        <div className="space-y-5">
          {APP_VARIANTS.map((variant) => (
            <div className="flex flex-wrap items-center gap-3" key={variant}>
              <div className="w-24 shrink-0">
                <DsMeta>{variant}</DsMeta>
              </div>
              <Button size="sm" variant={variant}>
                Log meal
              </Button>
              <Button variant={variant}>Log meal</Button>
              <Button size="lg" variant={variant}>
                Log meal
              </Button>
              <Button variant={variant}>
                Log meal
                <ArrowRight />
              </Button>
              <Button disabled variant={variant}>
                Log meal
              </Button>
            </div>
          ))}
        </div>
        <p className="mt-5 text-nham-text-muted text-xs leading-relaxed">
          Last column is the disabled state. Focus with the keyboard (Tab) to
          see the 3px tan ring — components never override it with blue.
        </p>
      </DsCard>

      <DsCard title="Landing & hero variants — token-only, no raw hexes">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="landing" variant="landing-primary">
            Start tracking free
          </Button>
          <Button size="landing" variant="landing-secondary">
            See how it works
          </Button>
          <Button variant="landing-ghost">Sign in</Button>
          <Button size="header" variant="header-cta">
            Get started
          </Button>
          <Button className="h-11" variant="landing-ink">
            Start free trial
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="hero" variant="hero-dark">
            Start tracking free
            <ArrowRight />
          </Button>
          <Button size="hero" variant="hero-outline">
            <Check />
            See a live demo
          </Button>
        </div>
        <p className="mt-5 text-nham-text-muted text-xs leading-relaxed">
          Hero CTAs are the only buttons that lift on hover (translateY(-2px));
          everything else darkens by one step with no movement. Never invent a
          new variant inline — extend buttonVariants in components/ui/button.tsx
          with tokens.
        </p>
      </DsCard>
    </DsSection>
  );
}
