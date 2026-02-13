'use client';

import { useMemo } from 'react';
import type { ChartConfiguration } from 'chart.js/auto';
import { useChart } from './useChart';
import { parsePipeString, mapToClockHours, generateDayColor, formatHour } from '@/lib/intraday-utils';
import type { DayRecord } from '@/lib/types';

const STAGE_LABELS: Record<number, string> = { 1: 'Deep', 2: 'Light', 3: 'REM', 4: 'Awake' };

interface SleepOverlayProps {
  data: DayRecord[];
}

export default function SleepOverlay({ data }: SleepOverlayProps) {
  const daysWithPhases = useMemo(
    () => data.filter(d => d.sleep?.phases_5min && d.sleep?.bedtime_start),
    [data],
  );

  const config = useMemo((): ChartConfiguration | null => {
    if (!daysWithPhases.length) return null;

    const datasets = daysWithPhases.map((d, i) => {
      const phases = parsePipeString(d.sleep!.phases_5min!);
      const points = mapToClockHours(phases, d.sleep!.bedtime_start!, 5);

      // Normalize into [0, 24) window starting at midnight
      const shifted = points.map(p => ({
        x: p.hour >= 12 ? p.hour - 24 : p.hour,
        y: p.value,
      }));

      const color = generateDayColor(i, daysWithPhases.length, [116, 185, 255], 0.35);
      const dayNum = parseInt(d.date.slice(8), 10);

      return {
        label: `Day ${dayNum}`,
        data: shifted,
        borderColor: color,
        borderWidth: 1.5,
        pointRadius: 0,
        stepped: 'before' as const,
        fill: false,
        tension: 0,
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
              label: (item) => {
                const y = item.parsed.y ?? 0;
                const stage = STAGE_LABELS[y] || `Stage ${y}`;
                return stage;
              },
            },
          },
        },
        scales: {
          x: {
            type: 'linear',
            min: -6,
            max: 12,
            ticks: {
              stepSize: 2,
              callback: (val) => formatHour(val as number),
              color: '#55556a',
              font: { size: 10 },
            },
            title: { display: true, text: 'Clock Time', color: '#55556a' },
            grid: { color: 'rgba(42, 42, 64, 0.5)' },
          },
          y: {
            min: 0.5,
            max: 4.5,
            ticks: {
              stepSize: 1,
              callback: (val) => STAGE_LABELS[Math.round(val as number)] ?? '',
              color: '#a8a8c0',
              font: { size: 12, weight: 'bold' as const },
              padding: 8,
            },
            afterFit: (axis: { width: number }) => { axis.width = 70; },
            grid: { color: 'rgba(42, 42, 64, 0.5)' },
          },
        },
      },
    };
  }, [daysWithPhases]);

  const canvasRef = useChart(config);

  if (!daysWithPhases.length) {
    return (
      <div className="overlay-chart-card">
        <h3>24-Hour Sleep Hypnogram</h3>
        <p className="overlay-fallback">Fetch from Oura to see sleep hypnogram overlay</p>
      </div>
    );
  }

  return (
    <div className="overlay-chart-card">
      <h3>24-Hour Sleep Hypnogram</h3>
      <canvas ref={canvasRef} />
    </div>
  );
}
