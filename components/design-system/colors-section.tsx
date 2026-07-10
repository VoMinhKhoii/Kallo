import { cn } from '@/lib/utils';
import { DsCard, DsMeta, DsSection } from './specimen';

type Swatch = {
  name: string;
  token: string;
  className: string;
  note: string;
  border?: boolean;
};

const BRAND: Swatch[] = [
  {
    name: 'Surface',
    token: '--nham-surface',
    className: 'bg-nham-surface',
    note: 'App background — paper cream',
    border: true,
  },
  {
    name: 'Text',
    token: '--nham-text',
    className: 'bg-nham-text',
    note: 'Primary text — espresso',
  },
  {
    name: 'Text muted',
    token: '--nham-text-muted',
    className: 'bg-nham-text-muted',
    note: 'Secondary text — warm taupe',
  },
  {
    name: 'Text soft',
    token: '--nham-text-soft',
    className: 'bg-nham-text-soft',
    note: 'Landing body copy',
  },
  {
    name: 'Accent',
    token: '--nham-accent',
    className: 'bg-nham-accent',
    note: 'Signature tan — highlights, italics',
  },
  {
    name: 'Accent hover',
    token: '--nham-accent-hover',
    className: 'bg-nham-accent-hover',
    note: 'Accent darkened one step',
  },
  {
    name: 'Border',
    token: '--nham-border',
    className: 'bg-nham-border',
    note: 'Hairlines, dividers — biscotti',
  },
  {
    name: 'Hover',
    token: '--nham-hover',
    className: 'bg-nham-hover',
    note: 'Hover wash for nav and rows',
    border: true,
  },
  {
    name: 'Track',
    token: '--nham-track',
    className: 'bg-nham-track',
    note: 'Disabled, tracks, chip ground',
    border: true,
  },
  {
    name: 'Stone',
    token: '--nham-stone',
    className: 'bg-nham-stone',
    note: 'Cool gray — captions, fat macro',
  },
  {
    name: 'Button',
    token: '--nham-btn',
    className: 'bg-nham-btn',
    note: 'Solid CTA — warm umber, not black',
  },
  {
    name: 'Ink',
    token: '--nham-ink',
    className: 'bg-nham-ink',
    note: 'Espresso as a surface (hero CTA)',
  },
];

const SEMANTIC: Swatch[] = [
  {
    name: 'primary',
    token: '--primary',
    className: 'bg-primary',
    note: 'Default button — resolves to umber',
  },
  {
    name: 'accent',
    token: '--accent',
    className: 'bg-accent',
    note: 'shadcn hover wash',
    border: true,
  },
  {
    name: 'muted',
    token: '--muted',
    className: 'bg-muted',
    note: 'Quiet fills',
    border: true,
  },
  {
    name: 'destructive',
    token: '--destructive',
    className: 'bg-destructive',
    note: 'Terracotta — never pure red',
  },
  {
    name: 'ring',
    token: '--ring',
    className: 'bg-ring',
    note: 'Focus ring — warm tan, never blue',
  },
  {
    name: 'border',
    token: '--border',
    className: 'bg-border',
    note: 'Default hairline',
  },
];

const STATUS: Swatch[] = [
  {
    name: 'Success',
    token: '--nham-success',
    className: 'bg-nham-success',
    note: 'Leafy sage',
  },
  {
    name: 'Danger',
    token: '--nham-danger',
    className: 'bg-nham-danger',
    note: 'Terracotta',
  },
  {
    name: 'Protein',
    token: '--nham-macro-protein',
    className: 'bg-nham-macro-protein',
    note: 'Same as accent',
  },
  {
    name: 'Carbs',
    token: '--nham-macro-carbs',
    className: 'bg-nham-macro-carbs',
    note: 'Same as text muted',
  },
  {
    name: 'Fat',
    token: '--nham-macro-fat',
    className: 'bg-nham-macro-fat',
    note: 'Same as stone',
  },
];

function SwatchGrid({ swatches }: { swatches: Swatch[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {swatches.map((s) => (
        <div key={s.token}>
          <div
            className={cn(
              'h-14 rounded-xl',
              s.className,
              s.border && 'border border-nham-border/60'
            )}
          />
          <p className="mt-2 font-medium text-nham-text text-sm">{s.name}</p>
          <DsMeta>{s.token}</DsMeta>
          <p className="mt-0.5 text-2xs text-nham-text-muted">{s.note}</p>
        </div>
      ))}
    </div>
  );
}

export function ColorsSection() {
  return (
    <DsSection
      accent="one warm palette"
      eyebrow="Color"
      id="color"
      intro="Everything is anchored on cream, espresso, and the Nhẩm tan. The shadcn semantic tokens (primary, destructive, ring, border…) are re-pointed at this palette, so stock components are on-brand without per-component overrides. No pure red, no pure green, no electric blue, no purple gradients — ever."
      title="Only"
    >
      <DsCard title="Brand tokens">
        <SwatchGrid swatches={BRAND} />
      </DsCard>
      <DsCard title="Semantic (shadcn) tokens — re-pointed">
        <SwatchGrid swatches={SEMANTIC} />
      </DsCard>
      <DsCard title="Status & macros — warm, never traffic lights">
        <SwatchGrid swatches={STATUS} />
      </DsCard>
    </DsSection>
  );
}
