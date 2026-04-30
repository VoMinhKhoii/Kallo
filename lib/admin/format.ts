export function formatUtcTimestamp(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${date.toISOString().replace('T', ' ').slice(0, 19)} UTC`;
}
