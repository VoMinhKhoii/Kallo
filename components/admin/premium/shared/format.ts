// Admin dates read the same on server and client: always UTC, never the
// viewer's zone, so a server-rendered row never mismatches on hydrate.
const day = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const dayTime = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

export function formatDay(value: Date | string | null): string {
  return value ? day.format(new Date(value)) : '—';
}

export function formatDayTime(value: Date | string | null): string {
  return value ? `${dayTime.format(new Date(value))} UTC` : '—';
}

export function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}
