/**
 * A calculator's answer: one large number, then a short list of the numbers
 * around it. `aria-live` so a screen reader hears the new result as the
 * inputs change.
 */
export function Result({
  label,
  value,
  unit,
  hint,
  rows = [],
  note,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  rows?: { label: string; value: string }[];
  note?: string;
}) {
  return (
    <div aria-live="polite" className="mt-8 border-kallo-border border-t pt-6">
      <p className="font-sans-display text-kallo-text-muted text-sm">{label}</p>
      <p className="mt-1 font-serif text-5xl text-kallo-text tabular-nums">
        {value}
        {unit ? (
          <span className="ml-2 font-sans text-base text-kallo-text-muted">
            {unit}
          </span>
        ) : null}
      </p>
      {hint ? (
        <p className="mt-1 text-kallo-text-muted text-sm">{hint}</p>
      ) : null}
      {rows.length ? (
        <dl className="mt-5 space-y-2">
          {rows.map((row) => (
            <div
              className="flex items-baseline justify-between gap-4 text-base"
              key={row.label}
            >
              <dt className="text-kallo-text-muted">{row.label}</dt>
              <dd className="text-kallo-text tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {note ? (
        <p className="mt-4 text-kallo-text-muted text-sm leading-relaxed">
          {note}
        </p>
      ) : null}
    </div>
  );
}

/** Empty state: a prompt instead of a misleading zero. */
export function NoResult({ text }: { text: string }) {
  return (
    <p className="mt-8 border-kallo-border border-t pt-6 text-kallo-text-muted text-sm">
      {text}
    </p>
  );
}
