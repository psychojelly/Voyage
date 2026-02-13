'use client';

import { useMemo } from 'react';
import type { ChartConfiguration } from 'chart.js/auto';
import { useChart } from './useChart';
import type { SleepData, WorkoutData, HeartData } from '@/lib/types';

interface SleepDonutProps {
  sleep: SleepData;
}

export function SleepDonut({ sleep }: SleepDonutProps) {
  const total = sleep.deep_min + sleep.rem_min + sleep.light_min + sleep.awake_min;

  const config = useMemo((): ChartConfiguration | null => {
    if (!total) return null;
    return {
      type: 'doughnut',
      data: {
        labels: ['Deep', 'REM', 'Light', 'Awake'],
        datasets: [{
          data: [sleep.deep_min, sleep.rem_min, sleep.light_min, sleep.awake_min],
          backgroundColor: ['#0984e3', '#6c5ce7', '#74b9ff', '#636e72'],
          borderWidth: 0,
        }],
      },
      options: {
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: { label: string; parsed: number }) => `${ctx.label}: ${ctx.parsed}m`,
            },
          },
        },
        scales: {},
      },
    } as unknown as ChartConfiguration;
  }, [sleep, total]);

  const canvasRef = useChart(config);

  if (!total) return null;

  return (
    <div className="day-chart-wrap">
      <div className="donut-container">
        <canvas ref={canvasRef} />
        <div className="donut-center">
          <span className="donut-value">{Math.round(total)}m</span>
          <span className="donut-label">Total</span>
        </div>
      </div>
      <div className="donut-legend">
        <span className="legend-item"><span className="legend-dot" style={{ background: '#0984e3' }} />Deep {sleep.deep_min}m</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: '#6c5ce7' }} />REM {sleep.rem_min}m</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: '#74b9ff' }} />Light {sleep.light_min}m</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: '#636e72' }} />Awake {sleep.awake_min}m</span>
      </div>
    </div>
  );
}

interface ActivityDonutProps {
  workout: WorkoutData;
}

export function ActivityDonut({ workout }: ActivityDonutProps) {
  const wakingMinutes = 960; // 16h waking day
  const active = workout.active_min;
  const rest = Math.max(0, wakingMinutes - active);

  const config = useMemo((): ChartConfiguration | null => {
    if (!active) return null;
    return {
      type: 'doughnut',
      data: {
        labels: ['Active', 'Rest'],
        datasets: [{
          data: [active, rest],
          backgroundColor: ['#55efc4', 'rgba(85, 239, 196, 0.15)'],
          borderWidth: 0,
        }],
      },
      options: {
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: { label: string; parsed: number }) => `${ctx.label}: ${ctx.parsed}m`,
            },
          },
        },
        scales: {},
      },
    } as unknown as ChartConfiguration;
  }, [active, rest]);

  const canvasRef = useChart(config);

  if (!active) return null;

  return (
    <div className="day-chart-wrap">
      <div className="donut-container">
        <canvas ref={canvasRef} />
        <div className="donut-center">
          <span className="donut-value">{active}m</span>
          <span className="donut-label">Active</span>
        </div>
      </div>
    </div>
  );
}

interface HRRangeBarProps {
  heart: HeartData;
}

export function HRRangeBar({ heart }: HRRangeBarProps) {
  const { hr_min, resting_hr, hr_max } = heart;
  if (!hr_max) return null;

  // Scale positions as percentages within the range
  const range = hr_max - hr_min || 1;
  const restingPos = ((resting_hr - hr_min) / range) * 100;

  return (
    <div className="day-chart-wrap">
      <div className="hr-range">
        <div className="hr-range-bar">
          <div
            className="hr-range-marker hr-range-resting"
            style={{ left: `${restingPos}%` }}
          >
            <span className="hr-range-label">{resting_hr}</span>
          </div>
        </div>
        <div className="hr-range-ends">
          <span className="hr-range-min">{hr_min} bpm</span>
          <span className="hr-range-max">{hr_max} bpm</span>
        </div>
      </div>
    </div>
  );
}
