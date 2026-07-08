const DEFAULT_BOOKING_TIMEZONE = 'America/Santiago';

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );

  const asUtc = Date.UTC(
    values['year'],
    values['month'] - 1,
    values['day'],
    values['hour'],
    values['minute'],
    values['second']
  );

  return asUtc - date.getTime();
}

export function zonedDateTimeToIso(
  dateKey: string,
  time: string,
  timeZone = DEFAULT_BOOKING_TIMEZONE
): string {
  const [year, month, day] = dateKey.split('T')[0].split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const firstOffset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  let utcTime = utcGuess - firstOffset;
  const secondOffset = getTimeZoneOffsetMs(new Date(utcTime), timeZone);

  if (secondOffset !== firstOffset) {
    utcTime = utcGuess - secondOffset;
  }

  return new Date(utcTime).toISOString();
}

export function isZonedDateTimeInPast(
  dateKey: string,
  time: string,
  timeZone = DEFAULT_BOOKING_TIMEZONE
): boolean {
  return new Date(zonedDateTimeToIso(dateKey, time, timeZone)).getTime() < Date.now();
}
