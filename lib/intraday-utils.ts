/** Parse an Oura phase string into number[].
 *  Handles both pipe-separated ("1|2|3|4") and continuous digit ("1234") formats.
 */
export function parsePipeString(str: string): number[] {
  if (str.includes('|')) {
    return str.split('|').map(Number);
  }
  // Continuous digit string — each character is a single value
  return Array.from(str, ch => Number(ch));
}

/** Map interval-based values to decimal clock hours starting from a timestamp.
 *  e.g. intervalMin=5, startTimestamp="2026-01-15T22:30:00+02:00"
 *  returns [{hour: 22.5, value: ...}, {hour: 22.583, value: ...}, ...]
 */
export function mapToClockHours(
  values: number[],
  startTimestamp: string,
  intervalMin: number,
): { hour: number; value: number }[] {
  const start = new Date(startTimestamp);
  return values.map((value, i) => {
    const ms = start.getTime() + i * intervalMin * 60_000;
    const d = new Date(ms);
    const hour = d.getHours() + d.getMinutes() / 60;
    return { hour, value };
  });
}

/** Generate an rgba color string for a given day index in a set */
export function generateDayColor(
  index: number,
  total: number,
  baseRgb: [number, number, number],
  alpha: number,
): string {
  // Shift lightness slightly per day for visual variety
  const shift = total > 1 ? (index / (total - 1)) * 40 - 20 : 0; // -20 to +20
  const r = Math.min(255, Math.max(0, baseRgb[0] + shift));
  const g = Math.min(255, Math.max(0, baseRgb[1] + shift));
  const b = Math.min(255, Math.max(0, baseRgb[2] + shift));
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
}

/** Format decimal hour to HH:MM string */
export function formatHour(h: number): string {
  const wrapped = ((h % 24) + 24) % 24;
  const hh = Math.floor(wrapped);
  const mm = Math.round((wrapped - hh) * 60);
  return `${hh}:${mm.toString().padStart(2, '0')}`;
}
