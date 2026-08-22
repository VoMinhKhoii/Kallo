import type { TimeRange } from '@/lib/core/types/dashboard';

export function buildXTicks(
  count: number,
  range: TimeRange,
  locale: string,
  nowLabel: string,
  weekPrefix: string
): { ticks: number[]; formatter: (v: number, idx: number) => string } {
  const uniqueTicks = (values: number[]) =>
    values.filter((value, index, array) => array.indexOf(value) === index);

  if (count < 2) {
    return {
      ticks: [0],
      formatter: () => nowLabel,
    };
  }

  if (range === '30d') {
    const step = Math.floor(count / 4);
    const ticks = uniqueTicks([0, step, step * 2, step * 3, count - 1]);
    return {
      ticks,
      formatter: (_v: number, idx: number) =>
        idx === ticks.length - 1 ? nowLabel : `${weekPrefix}${idx + 1}`,
    };
  }

  // 90d — show months
  const today = new Date();
  const monthFormatter = new Intl.DateTimeFormat(locale, { month: 'short' });
  const ticks: number[] = [];
  const labels: string[] = [];
  for (let i = 2; i > 0; i--) {
    const d = new Date(today);
    d.setMonth(d.getMonth() - i);
    const dayIndex = count - 1 - i * 30;
    ticks.push(Math.max(0, dayIndex));
    labels.push(monthFormatter.format(d));
  }
  ticks.push(count - 1);
  labels.push(nowLabel);
  return {
    ticks: uniqueTicks(ticks),
    formatter: (_v: number, idx: number) => labels[idx] ?? '',
  };
}
