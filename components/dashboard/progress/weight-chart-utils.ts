import type { TimeRange } from '@/components/dashboard/types';

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function buildXTicks(
  count: number,
  range: TimeRange
): { ticks: number[]; formatter: (v: number, idx: number) => string } {
  if (range === '30d') {
    const step = Math.floor(count / 4);
    const ticks = [0, step, step * 2, step * 3, count - 1];
    return {
      ticks,
      formatter: (_v: number, idx: number) =>
        idx === ticks.length - 1 ? 'Now' : `W${idx + 1}`,
    };
  }

  // 90d — show months
  const today = new Date();
  const ticks: number[] = [];
  const labels: string[] = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(today);
    d.setMonth(d.getMonth() - i);
    const dayIndex = count - 1 - i * 30;
    ticks.push(Math.max(0, dayIndex));
    labels.push(MONTHS_SHORT[d.getMonth()]);
  }
  ticks.push(count - 1);
  labels.push('Now');
  return {
    ticks,
    formatter: (_v: number, idx: number) => labels[idx] ?? '',
  };
}
