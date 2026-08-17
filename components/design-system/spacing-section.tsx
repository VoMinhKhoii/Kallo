import { cn } from '@/lib/core/ui/cn';
import { DsCard, DsMeta, DsSection } from './specimen';

const STEPS = [
  { cls: 'w-1', label: '1 · 4px', use: 'icon-to-dot gaps' },
  { cls: 'w-2', label: '2 · 8px', use: 'icon-to-label gap' },
  { cls: 'w-3', label: '3 · 12px', use: 'stacked rows inside a card' },
  { cls: 'w-4', label: '4 · 16px', use: 'compact card padding (p-card-sm)' },
  { cls: 'w-5', label: '5 · 20px', use: 'default card padding (p-card)' },
  { cls: 'w-6', label: '6 · 24px', use: 'grid gutters between cards' },
  {
    cls: 'w-8',
    label: '8 · 32px',
    use: 'between sections (gap-section) · feature-card padding (p-card-lg)',
  },
  { cls: 'w-12', label: '12 · 48px', use: 'page-level breathing room' },
  { cls: 'w-24', label: '24 · 96px', use: 'marketing band rhythm (py-band)' },
] as const;

export function SpacingSection() {
  return (
    <DsSection
      accent="the dashboard breathes"
      eyebrow="Spacing"
      id="spacing"
      intro="A 4px base scale on Anthropic's rhythm (4/8/12/16/24/32/48/96), skewed generous: product cards get 16–20px of internal padding, marketing feature cards 32px, sections 32px apart, marketing bands 96px. Semantic steps (p-card, p-card-sm, p-card-lg, gap-section, py-band) name the recurring decisions so they stop being re-made per screen."
      title="Four-pixel rhythm —"
    >
      <DsCard title="The scale">
        <div className="space-y-2.5">
          {STEPS.map((s) => (
            <div className="flex items-center gap-4" key={s.cls}>
              <div className="w-16 shrink-0">
                <DsMeta>{s.label}</DsMeta>
              </div>
              <div className={cn('h-4 rounded-sm bg-kallo-accent', s.cls)} />
              <p className="text-2xs text-kallo-text-muted">{s.use}</p>
            </div>
          ))}
        </div>
      </DsCard>

      <DsCard title="Card rhythm — p-card outside, gap-3 stacks inside">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-kallo-border/60 bg-kallo-surface p-card">
            <p className="eyebrow">Default card</p>
            <div className="mt-3 space-y-3">
              <div className="h-3 w-3/4 rounded-full bg-kallo-track" />
              <div className="h-3 w-1/2 rounded-full bg-kallo-track" />
              <div className="h-3 w-2/3 rounded-full bg-kallo-track" />
            </div>
            <DsMeta>p-card (20px) · space-y-3 (12px)</DsMeta>
          </div>
          <div className="rounded-2xl border border-kallo-border/60 bg-kallo-surface p-card-sm">
            <p className="eyebrow">Compact card</p>
            <div className="mt-3 space-y-2">
              <div className="h-3 w-3/4 rounded-full bg-kallo-track" />
              <div className="h-3 w-1/2 rounded-full bg-kallo-track" />
            </div>
            <DsMeta>p-card-sm (16px) · space-y-2 (8px)</DsMeta>
          </div>
        </div>
        <p className="mt-4 text-kallo-text-muted text-xs leading-relaxed">
          Rules of thumb: one padding value per card — never mix p-4 and p-5 on
          siblings. Sections stack with gap-section (32px). Content never
          exceeds 1440px. When a layout feels cramped, add space before adding
          chrome.
        </p>
      </DsCard>
    </DsSection>
  );
}
