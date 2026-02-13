'use client';

import { useMemo } from 'react';
import type { ChartConfiguration } from 'chart.js/auto';
import { useChart } from './useChart';
import { parsePipeString, mapToClockHours, generateDayColor, formatHour } from '@/lib/intraday-utils';
import type { DayRecord } from '@/lib/types';

interface ActivityOverlayProps {
  data: DayRecord[];
}

export default function ActivityOverlay({ data }: ActivityOverlayProps) {
  const daysWithIntraday = useMemo(
    () => data.filter(d =>
      (d.workout?.met_items && d.workout.met_items.length > 0 && d.workout.met_timestamp) ||
      d.workout?.class_5min,
    ),
    [data],
  );

  const config = useMemo((): ChartConfiguration | null => {
    if (!daysWithIntraday.length) return null;

    const datasets = daysWithIntraday.map((d, i) => {
      let points: { x: number; y: number }[];
      let yLabel: string;

      if (d.workout!.met_items && d.workout!.met_items.length > 0 && d.workout!.met_timestamp) {
        // MET data (5-min buckets)
        const mapped = mapToClockHours(d.workout!.met_items, d.workout!.met_timestamp, 5);
        points = mapped.map(p => ({ x: p.hour, y: p.value }));
        yLabel = 'MET';
      } else {
        // Fallback to class_5min — need a midnight start assumption
        const phases = parsePipeString(d.workout!.class_5min!);
        // class_5min typically starts at midnight (00:00) for daily activity
        const startOfDay = d.date + 'T00:00:00';
        const mapped = mapToClockHours(phases, startOfDay, 5);
        points = mapped.map(p => ({ x: p.hour, y: p.value }));
        yLabel = 'Activity Class';
      }

      points.sort((a, b) => a.x - b.x);

      const borderColor = generateDayColor(i, daysWithIntraday.length, [85, 239, 196], 0.25);
      const bgColor = generateDayColor(i, daysWithIntraday.length, [85, 239, 196], 0.05);
      const dayNum = parseInt(d.date.slice(8), 10);

      return {
        label: `Day ${dayNum}`,
        data: points,
        borderColor,
        backgroundColor: bgColor,
        borderWidth: 1.5,
        pointRadius: 0,
        fill: true,
        tension: 0.3,
        _yLabel: yLabel,
      };
    });

    // Determine Y axis label from first dataset
    const yAxisLabel = (datasets[0] as { _yLabel?: string })?._yLabel || 'MET';

    return {
      type: 'line',
      data: { datasets },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const item = items[0];
                if (!item) return '';
                return `${item.dataset.label} - ${formatHour(item.parsed.x ?? 0)}`;
              },
              label: (item) => `${(item.parsed.y ?? 0).toFixed(1)} ${yAxisLabel}`,
            },
          },
        },
        scales: {
          x: {
            type: 'linear',
            min: 0,
            max: 24,
            ticks: {
              stepSize: 3,
              callback: (val) => formatHour(val as number),
              color: '#55556a',
              font: { size: 10 },
            },
            title: { display: true, text: 'Time of Day', color: '#55556a' },
            grid: { color: 'rgba(42, 42, 64, 0.5)' },
          },
          y: {
            ticks: { color: '#55556a', font: { size: 10 } },
            title: { display: true, text: yAxisLabel, color: '#55556a' },
            grid: { color: 'rgba(42, 42, 64, 0.5)' },
          },
        },
      },
    };
  }, [daysWithIntraday]);

  const canvasRef = useChart(config);

  if (!daysWithIntraday.length) {
    return (
      <div className="overlay-chart-card">
        <h3>24-Hour Activity Overlay</h3>
        <p className="overlay-fallback">Fetch from Oura to see activity timeline</p>
      </div>
    );
  }

  return (
    <div className="overlay-chart-card">
      <h3>24-Hour Activity Overlay</h3>
      <canvas ref={canvasRef} />
    </div>
  );
}
