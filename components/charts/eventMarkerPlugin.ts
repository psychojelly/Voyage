import type { Chart, Plugin } from 'chart.js/auto';
import type { HealthEvent, EventCategory } from '@/lib/types';

export interface MarkerHitbox {
  x: number;
  width: number;
  top: number;
  bottom: number;
  event: HealthEvent;
}

const CATEGORY_COLORS: Record<EventCategory, string> = {
  activity: '#55efc4',
  sleep: '#74b9ff',
  'health-note': '#ff6b6b',
  custom: '#dfe6e9',
  experience: '#e056fd',
};

const CATEGORY_LETTERS: Record<EventCategory, string> = {
  activity: 'A',
  sleep: 'S',
  'health-note': 'H',
  custom: 'C',
  experience: 'E',
};

function getEventColor(event: HealthEvent): string {
  return event.color || CATEGORY_COLORS[event.category] || '#dfe6e9';
}

function parseTimeToHour(time: string, effectiveStart: number): number {
  const [h, m] = time.split(':').map(Number);
  let hour = h + m / 60;
  while (hour < effectiveStart) hour += 24;
  while (hour >= effectiveStart + 24) hour -= 24;
  return hour;
}

export { CATEGORY_COLORS };

export interface EventMarkerPluginOptions {
  events: HealthEvent[];
  effectiveStart: number;
}

// Augment Chart.js types to allow the custom eventMarkers plugin option
declare module 'chart.js' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface PluginOptionsByType<TType extends import('chart.js').ChartType> {
    eventMarkers?: EventMarkerPluginOptions;
  }
}

/**
 * Creates a Chart.js inline plugin that draws vertical dashed event markers.
 * The hitboxRef array is populated on each draw for click detection.
 */
export function createEventMarkerPlugin(
  hitboxRef: { current: MarkerHitbox[] },
): Plugin {
  return {
    id: 'eventMarkers',

    afterDatasetsDraw(chart: Chart) {
      const pluginOpts = (chart.options.plugins as Record<string, unknown>)?.eventMarkers as
        | EventMarkerPluginOptions
        | undefined;
      if (!pluginOpts?.events?.length) {
        hitboxRef.current = [];
        return;
      }

      const { events, effectiveStart } = pluginOpts;
      const ctx = chart.ctx;
      const xScale = chart.scales['x'];
      const chartArea = chart.chartArea;
      if (!xScale || !chartArea) return;

      const hitboxes: MarkerHitbox[] = [];

      for (const event of events) {
        const startHour = parseTimeToHour(event.time, effectiveStart);
        const x = xScale.getPixelForValue(startHour);
        if (x < chartArea.left || x > chartArea.right) continue;

        const color = getEventColor(event);
        const letter = CATEGORY_LETTERS[event.category] || 'C';
        const hasEnd = !!event.endTime;

        // Compute end pixel if event has an end time
        let xEnd = x;
        if (hasEnd) {
          const endHour = parseTimeToHour(event.endTime!, effectiveStart);
          // If end is before start, it crosses midnight
          const adjustedEnd = endHour <= startHour ? endHour + 24 : endHour;
          xEnd = xScale.getPixelForValue(adjustedEnd);
          // Clamp to chart area
          const clampedEnd = Math.min(xEnd, chartArea.right);
          const clampedStart = Math.max(x, chartArea.left);

          // Draw shaded duration region
          ctx.save();
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.1;
          ctx.fillRect(clampedStart, chartArea.top, clampedEnd - clampedStart, chartArea.bottom - chartArea.top);
          ctx.restore();

          // Draw end time dashed line
          if (xEnd >= chartArea.left && xEnd <= chartArea.right) {
            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([2, 4]);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.4;
            ctx.moveTo(xEnd, chartArea.top);
            ctx.lineTo(xEnd, chartArea.bottom);
            ctx.stroke();
            ctx.restore();
          }
        }

        // Draw start time dashed vertical line
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.7;
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
        ctx.restore();

        // Draw label badge at top
        const badgeSize = 16;
        const badgeY = chartArea.top - badgeSize - 4;

        ctx.save();
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(x, badgeY + badgeSize / 2, badgeSize / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1a1a2e';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = 1;
        ctx.fillText(letter, x, badgeY + badgeSize / 2);
        ctx.restore();

        // Hitbox spans the full duration if event has end time
        const hitLeft = x - 12;
        const hitRight = hasEnd ? Math.max(xEnd + 12, x + 12) : x + 12;
        hitboxes.push({
          x: hitLeft,
          width: hitRight - hitLeft,
          top: badgeY,
          bottom: chartArea.bottom,
          event,
        });
      }

      hitboxRef.current = hitboxes;
    },
  };
}
