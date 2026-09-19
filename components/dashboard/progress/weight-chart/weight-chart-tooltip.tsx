import { useTranslations } from 'next-intl';

interface TooltipPayloadItem {
  dataKey?: string | number;
  value?: number | null;
}

export function WeightChartTooltip({
  active,
  payload,
  label,
  formatDay,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: number;
  formatDay?: (day: number) => string;
}) {
  const t = useTranslations('dashboard');

  if (!active || !payload?.length) return null;

  // Two series share one payload, and the forecast tail carries a null `actual`
  // — so pick the logged series by name and bail when it has no reading, rather
  // than trusting payload[0] to be a number.
  const logged = payload.find((item) => item.dataKey === 'actual');
  if (typeof logged?.value !== 'number') return null;

  const when = typeof label === 'number' ? formatDay?.(label) : undefined;

  return (
    <div className="rounded-lg border border-kallo-border/60 bg-card px-3 py-1.5 shadow-md">
      {when && <p className="text-[11px] text-kallo-text-muted">{when}</p>}
      <span className="font-mono text-kallo-text text-xs tabular-nums">
        {logged.value.toFixed(1)} {t('units.kg')}
      </span>
    </div>
  );
}
