'use client';

import { useMemo } from 'react';
import type { ChartConfiguration } from 'chart.js/auto';
import { useChart } from './useChart';
import { generateDayColor, formatHour } from '@/lib/intraday-utils';
import type { DayRecord } from '@/lib/types';

interface HeartRateOverlayProps {
  data: DayRecord[];
}

export default function HeartRateOverlay({ data }: HeartRateOverlayProps) {
  const daysWithSamples = useMemo(
    () => data.filter(d => d.heart?.samples && d.heart.samples.length > 0),
    [data],
  );

  const config = useMemo((): ChartConfiguration | null => {
    if (!daysWithSamples.length) return null;

    const datasets = daysWithSamples.map((d, i) => {
      const points = d.heart!.samples!.map(s => {
        const dt = new Date(s.ts);
        const hour = dt.getHours() + dt.getMinutes() / 60;
        return { x: hour, y: s.bpm };
      }).sort((a, b) => a.x - b.x);

      const color = generateDayColor(i, daysWithSamples.length, [255, 107, 107], 0.25);
      const dayNum = parseInt(d.date.slice(8), 10);

      return {
        label: `Day ${dayNum}`,
        data: points,
        borderColor: color,
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
        tension: 0.3,
      };
    });

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
              label: (item) => `${item.parsed.y ?? 0} BPM`,
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
            title: { display: true, text: 'BPM', color: '#55556a' },
            grid: { color: 'rgba(42, 42, 64, 0.5)' },
          },
        },
      },
    };
  }, [daysWithSamples]);

  const canvasRef = useChart(config);

  if (!daysWithSamples.length) {
    return (
      <div className="overlay-chart-card">
        <h3>24-Hour Heart Rate Overlay</h3>
        <p className="overlay-fallback">Fetch from Oura to see heart rate timeline</p>
      </div>
    );
  }

  return (
    <div className="overlay-chart-card">
      <h3>24-Hour Heart Rate Overlay</h3>
      <canvas ref={canvasRef} />
    </div>
  );
}
