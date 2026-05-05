export function getUtcDayRangeForLocalDate(
  date: string,
  timezoneOffset: number
) {
  const offsetMs = timezoneOffset * 60 * 1000;
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  dayStart.setTime(dayStart.getTime() + offsetMs);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  return { dayStart, dayEnd };
}

export function getUtcInstantForLocalDate(
  date: string,
  timezoneOffset: number,
  timeSource = new Date()
) {
  const [year, month, day] = date.split('-').map(Number);
  const localNow = new Date(timeSource.getTime() - timezoneOffset * 60 * 1000);
  const localDateTimeMs =
    Date.UTC(
      year,
      month - 1,
      day,
      localNow.getUTCHours(),
      localNow.getUTCMinutes(),
      localNow.getUTCSeconds(),
      localNow.getUTCMilliseconds()
    ) +
    timezoneOffset * 60 * 1000;

  return new Date(localDateTimeMs);
}
