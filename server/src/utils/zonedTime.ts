/**
 * Epoch milliseconds for a wall-clock date and time in a named IANA zone. The
 * server's copy of the client's helper: the run's wall-clock start is kept, and
 * the instant is worked out from the zone's own daylight-saving rules.
 */
export function zoneOffsetMs(epochMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(epochMs));
  const field = (type: string) => Number(parts.find(p => p.type === type)?.value);
  const wallAsUtc = Date.UTC(field('year'), field('month') - 1, field('day'), field('hour'), field('minute'), field('second'));
  return wallAsUtc - Math.floor(epochMs / 1000) * 1000;
}

export function zonedDateTimeToEpoch(date: string, startTime: string, timeZone: string): number {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = startTime.split(':').map(Number);
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const firstGuess = wallAsUtc - zoneOffsetMs(wallAsUtc, timeZone);
  return wallAsUtc - zoneOffsetMs(firstGuess, timeZone);
}
