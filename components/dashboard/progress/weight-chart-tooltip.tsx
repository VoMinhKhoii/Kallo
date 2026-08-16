export function WeightChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-kallo-border/60 bg-card px-3 py-1.5 shadow-md">
      <span className="font-mono text-kallo-text text-xs">
        {payload[0].value.toFixed(1)} kg
      </span>
    </div>
  );
}
