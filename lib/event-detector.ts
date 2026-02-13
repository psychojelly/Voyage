import type { HealthEvent, WorkoutData } from './types';
import { mapToClockHours } from './intraday-utils';

/**
 * Auto-detect workout events from Oura MET data.
 * Finds sustained periods where MET > 3.0 for 15+ minutes (3 consecutive 5-min intervals).
 */
export function detectWorkoutEvents(workout: WorkoutData | undefined, date: string): HealthEvent[] {
  if (!workout?.met_items?.length || !workout.met_timestamp) return [];

  const mapped = mapToClockHours(workout.met_items, workout.met_timestamp, 5);
  const events: HealthEvent[] = [];
  let burstStart = -1;
  let peakMet = 0;

  for (let i = 0; i <= mapped.length; i++) {
    const val = i < mapped.length ? mapped[i].value : 0;

    if (val > 3.0) {
      if (burstStart === -1) burstStart = i;
      if (val > peakMet) peakMet = val;
    } else {
      if (burstStart !== -1) {
        const count = i - burstStart;
        const durationMin = count * 5;
        if (durationMin >= 15) {
          const startHour = mapped[burstStart].hour;
          const hh = Math.floor(startHour);
          const mm = Math.round((startHour - hh) * 60);
          const timeStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
          const isHigh = peakMet > 6;

          events.push({
            id: `auto-${date}-${timeStr}`,
            time: timeStr,
            title: isHigh ? 'High Intensity Activity' : 'Moderate Activity',
            category: 'activity',
            description: `${durationMin} min, peak ${peakMet.toFixed(1)} MET`,
            isAuto: true,
          });
        }
        burstStart = -1;
        peakMet = 0;
      }
    }
  }

  return events;
}
