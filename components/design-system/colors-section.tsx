import { cn } from '@/lib/ui/cn';
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
    token: '--kallo-surface',
    className: 'bg-kallo-surface',
    note: 'App background — neutral gray-white',
    border: true,
  },
  {
    name: 'Text',
    token: '--kallo-text',
    className: 'bg-kallo-text',
    note: 'Primary text — near-black ink',
  },
  {
    name: 'Text muted',
    token: '--kallo-text-muted',
    className: 'bg-kallo-text-muted',
    note: 'Secondary text — muted neutral ink',
  },
  {
    name: 'Text soft',
    token: '--kallo-text-soft',
    className: 'bg-kallo-text-soft',
    note: 'Landing body copy',
  },
  {
    name: 'Accent',
    token: '--kallo-accent',
    className: 'bg-kallo-accent',
    note: 'Signature tan — highlights, italics',
  },
  {
    name: 'Accent hover',
    token: '--kallo-accent-hover',
    className: 'bg-kallo-accent-hover',
    note: 'Accent darkened one step',
  },
  {
    name: 'Border',
    token: '--kallo-border',
    className: 'bg-kallo-border',
    note: 'Hairlines, dividers — neutral hairline',
  },
  {
    name: 'Hover',
    token: '--kallo-hover',
    className: 'bg-kallo-hover',
    note: 'Warm beige hover/selected wash',
    border: true,
  },
  {
    name: 'Track',
    token: '--kallo-track',
    className: 'bg-kallo-track',
    note: 'Warm track — disabled, skeletons, chips',
    border: true,
  },
  {
    name: 'Stone',
    token: '--kallo-stone',
    className: 'bg-kallo-stone',
    note: 'Cool gray — captions, fat macro',
  },
  {
    name: 'Button',
    token: '--kallo-btn',
    className: 'bg-kallo-btn',
    note: 'Solid CTA — warm umber, not black',
  },
  {
    name: 'Ink',
    token: '--kallo-ink',
    className: 'bg-kallo-ink',
    note: 'Ink as a surface (hero CTA)',
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
    token: '--kallo-success',
    className: 'bg-kallo-success',
    note: 'Leafy sage',
  },
  {
    name: 'Danger',
    token: '--kallo-danger',
    className: 'bg-kallo-danger',
    note: 'Terracotta',
  },
  {
    name: 'Protein',
    token: '--kallo-macro-protein',
    className: 'bg-kallo-macro-protein',
    note: 'Same as accent',
  },
  {
    name: 'Carbs',
    token: '--kallo-macro-carbs',
    className: 'bg-kallo-macro-carbs',
    note: 'Same as text muted',
  },
  {
    name: 'Fat',
    token: '--kallo-macro-fat',
    className: 'bg-kallo-macro-fat',
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
              s.border && 'border border-kallo-border/60'
            )}
          />
          <p className="mt-2 font-medium text-kallo-text text-sm">{s.name}</p>
          <DsMeta>{s.token}</DsMeta>
          <p className="mt-0.5 text-2xs text-kallo-text-muted">{s.note}</p>
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
      intro="Everything is anchored on the neutral canvas, near-black ink, and the Kallo tan. The shadcn semantic tokens (primary, destructive, ring, border…) are re-pointed at this palette, so stock components are on-brand without per-component overrides. No pure red, no pure green, no electric blue, no purple gradients — ever."
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
