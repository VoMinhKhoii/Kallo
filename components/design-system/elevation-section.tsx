import { DsCard, DsMeta, DsSection } from './specimen';

const RADII = [
  { cls: 'rounded-lg', label: 'lg · 8px', use: 'inputs, small buttons' },
  { cls: 'rounded-xl', label: 'xl · 12px', use: 'chips, suggestion pills' },
  { cls: 'rounded-2xl', label: '2xl · 16px', use: 'most cards, meal entries' },
  { cls: 'rounded-3xl', label: '3xl · 20px', use: 'feature panels, the dock' },
  { cls: 'rounded-4xl', label: '4xl · 24px', use: 'hero phone bezel' },
  { cls: 'rounded-full', label: 'pill', use: 'avatars, floating trigger' },
] as const;

const SHADOWS = [
  { cls: 'shadow-2xs', label: 'shadow-2xs', use: 'barely-there row lift' },
  { cls: 'shadow-xs', label: 'shadow-xs', use: 'default card shadow' },
  {
    cls: 'shadow-sm',
    label: 'shadow-sm',
    use: 'the canonical shadow — chips, lifted rows',
  },
  { cls: 'shadow-md', label: 'shadow-md', use: 'popovers, dropdowns' },
  { cls: 'shadow-lg', label: 'shadow-lg', use: 'modals, hero CTAs' },
  {
    cls: 'shadow-hero',
    label: 'shadow-hero',
    use: 'tan glow — hero mock only',
  },
] as const;

export function ElevationSection() {
  return (
    <DsSection
      accent="shadows whisper"
      eyebrow="Elevation & shape"
      id="elevation"
      intro="Anthropic's minimal-shadow philosophy: depth comes from surface color-blocking (cream, white, ink) and hairline borders — shadows only confirm it. Every shadow is tinted with espresso, rgba(44, 36, 22, …) at 4–14%, so nothing reads cold on cream. Radii sit on the 4/8/12/16 scale; one radius family per card."
      title="Borders separate,"
    >
      <DsCard title="Radius family">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {RADII.map((r) => (
            <div key={r.cls}>
              <div
                className={`h-16 border border-nham-border bg-nham-surface ${r.cls}`}
              />
              <p className="mt-2 font-medium text-nham-text text-sm">
                {r.label}
              </p>
              <p className="text-2xs text-nham-text-muted">{r.use}</p>
            </div>
          ))}
        </div>
      </DsCard>

      <DsCard className="bg-nham-surface" title="Warm shadow scale">
        <div className="grid grid-cols-2 gap-6 py-4 sm:grid-cols-3 lg:grid-cols-6">
          {SHADOWS.map((s) => (
            <div key={s.cls}>
              <div className={`h-16 rounded-2xl bg-white ${s.cls}`} />
              <div className="mt-3">
                <DsMeta>{s.label}</DsMeta>
                <p className="mt-0.5 text-2xs text-nham-text-muted">{s.use}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-nham-text-muted text-xs leading-relaxed">
          The scale replaces Tailwind&rsquo;s black-based defaults globally —
          shadow-sm anywhere in the app is already warm, and matches
          Anthropic&rsquo;s one canonical shadow (0 1px 3px at 8%). If a surface
          needs to stand out, reach for a border or a surface color change
          before a bigger shadow.
        </p>
      </DsCard>
    </DsSection>
  );
}
