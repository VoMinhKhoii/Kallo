import { DsCard, DsMeta, DsSection } from './specimen';

const RAMP = [
  {
    role: 'text-display',
    sample: 'Track meals',
    className: 'font-serif text-display',
    metrics: 'clamp(32–64px) · lh 1.05 · tracking -0.023em · Lora 400',
    use: 'Hero headline only',
  },
  {
    role: 'text-h1',
    sample: 'Your week in food',
    className: 'font-serif text-h1',
    metrics: '48px · lh 1.1 · tracking -0.021em · Lora 400',
    use: 'Page titles',
  },
  {
    role: 'text-h2',
    sample: 'Consistency map',
    className: 'font-serif text-h2',
    metrics: '36px · lh 1.15 · tracking -0.014em · Lora 400',
    use: 'Section titles',
  },
  {
    role: 'text-h3',
    sample: 'Today at a glance',
    className: 'font-serif text-h3',
    metrics: '28px · lh 1.2 · tracking -0.011em · Lora 400',
    use: 'Card titles, feature titles',
  },
  {
    role: 'text-h4',
    sample: 'Protein this week',
    className: 'font-serif text-h4',
    metrics: '22px · lh 1.3 · Lora 400',
    use: 'Sub-blocks inside cards',
  },
  {
    role: 'text-lg',
    sample: 'Describe a meal the way you would tell a friend.',
    className: 'text-lg text-kallo-text-muted',
    metrics: '18px · sans',
    use: 'Lead paragraphs',
  },
  {
    role: 'text-base / text-sm',
    sample: 'Server-anchored protein and carbs, with prep modifiers honored.',
    className: 'text-sm',
    metrics: '16 / 14px · lh 1.55 · sans',
    use: 'Body and UI text',
  },
  {
    role: 'text-caption',
    sample: 'Weight basis — cooked, drained',
    className: 'text-caption text-kallo-text-muted',
    metrics: '13px · lh 1.4 · sans 500',
    use: 'Form labels, list captions',
  },
  {
    role: 'text-xs / text-2xs',
    sample: 'Logged 12 minutes ago · 3 ingredients',
    className: 'text-2xs text-kallo-stone',
    metrics: '12 / 11px · sans',
    use: 'Meta rows, timestamps',
  },
] as const;

export function TypographySection() {
  return (
    <DsSection
      accent="never bold Lora"
      eyebrow="Typography"
      id="typography"
      intro="Two typefaces with strict jobs, on Anthropic's ramp (64/48/36/28/22, tightening leading as size grows). Lora (serif) carries every headline, number above 18px, and quoted meal string — always weight 400 or lighter. Be Vietnam Pro (sans) carries every button, label, and paragraph below 18px. Sentence case everywhere; UPPERCASE only in the 10px eyebrow."
      title="Two faces,"
    >
      <DsCard title="The ramp — each utility carries size, leading, tracking and weight">
        <div className="space-y-6">
          {RAMP.map((r) => (
            <div key={r.role}>
              <p className={r.className}>{r.sample}</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-4">
                <DsMeta>
                  {r.role} — {r.metrics}
                </DsMeta>
                <p className="text-2xs text-kallo-text-muted">{r.use}</p>
              </div>
            </div>
          ))}
        </div>
      </DsCard>

      <DsCard title="Signature moves">
        <div className="space-y-8">
          <div>
            <h3 className="font-serif text-h2">
              Track Vietnamese meals{' '}
              <span className="italic-accent">without the guesswork</span>
            </h3>
            <DsMeta>
              .italic-accent — second clause in italic 300 at the tan accent
            </DsMeta>
          </div>
          <div>
            <p className="eyebrow">This week</p>
            <DsMeta>
              .eyebrow — 10px, 700, uppercase, 0.2em tracking. One per section,
              max two per screen
            </DsMeta>
          </div>
          <div>
            <p className="font-serif text-h1 tabular-nums">
              1,860{' '}
              <span className="text-h4 text-kallo-text-muted">
                – 2,040 kcal
              </span>
            </p>
            <DsMeta>
              Numbers — Lora, tabular-nums, shown as bounded ranges, never fake
              single-decimal precision
            </DsMeta>
          </div>
          <div>
            <p className="font-serif text-lg leading-relaxed">
              &ldquo;2 mực kho mặn + 50gr nạc dăm luộc + 1 chén cơm + canh
              chua&rdquo;
            </p>
            <DsMeta>
              Meal quote — the user&rsquo;s words in Lora with curly quotes,
              diacritics always preserved
            </DsMeta>
          </div>
        </div>
      </DsCard>
    </DsSection>
  );
}
