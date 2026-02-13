'use client';

import { useMemo, useCallback } from 'react';
import type { ChartConfiguration } from 'chart.js/auto';
import { useChart, useChartWithClick, getDayLabels } from './useChart';
import type { DayRecord } from '@/lib/types';

interface SleepChartsProps {
  data: DayRecord[];
  onDayClick?: (date: string) => void;
}

export default function SleepCharts({ data, onDayClick }: SleepChartsProps) {
  const stagesConfig = useMemo((): ChartConfiguration | null => {
    if (!data.length) return null;
    const labels = getDayLabels(data);
    return {
      type: 'bar' as const,
      data: {
        labels,
        datasets: [
          { label: 'Deep', data: data.map(d => d.sleep?.deep_min || 0), backgroundColor: '#0984e3', stack: 'stack' },
          { label: 'REM', data: data.map(d => d.sleep?.rem_min || 0), backgroundColor: '#6c5ce7', stack: 'stack' },
          { label: 'Light', data: data.map(d => d.sleep?.light_min || 0), backgroundColor: '#74b9ff', stack: 'stack' },
          { label: 'Awake', data: data.map(d => d.sleep?.awake_min || 0), backgroundColor: '#636e72', stack: 'stack' },
        ],
      },
      options: {
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { stacked: true },
          y: { stacked: true, title: { display: true, text: 'Minutes', color: '#55556a' } },
        },
      },
    };
  }, [data]);

  const durationConfig = useMemo((): ChartConfiguration | null => {
    if (!data.length) return null;
    return {
      type: 'line',
      data: {
        labels: getDayLabels(data),
        datasets: [{
          label: 'Hours',
          data: data.map(d => d.sleep?.duration_hours || 0),
          borderColor: '#74b9ff',
          backgroundColor: 'rgba(116, 185, 255, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#74b9ff',
        }],
      },
      options: {
        scales: { y: { min: 4, max: 10, title: { display: true, text: 'Hours', color: '#55556a' } } },
      },
    };
  }, [data]);

  const readinessConfig = useMemo((): ChartConfiguration | null => {
    if (!data.length) return null;
    return {
      type: 'line',
      data: {
        labels: getDayLabels(data),
        datasets: [{
          label: 'Readiness',
          data: data.map(d => d.sleep?.readiness_score || 0),
          borderColor: '#a29bfe',
          backgroundColor: 'rgba(162, 155, 254, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#a29bfe',
        }],
      },
      options: {
        scales: { y: { min: 0, max: 100, title: { display: true, text: 'Score', color: '#55556a' } } },
      },
    };
  }, [data]);

  const handleClickIndex = useCallback((index: number) => {
    if (onDayClick && data[index]) onDayClick(data[index].date);
  }, [onDayClick, data]);

  const stagesRef = useChartWithClick(stagesConfig, handleClickIndex);
  const durationRef = useChart(durationConfig);
  const readinessRef = useChart(readinessConfig);

  return (
    <div className="charts-grid">
        <div className="chart-card">
          <h3>Sleep Stages</h3>
          <canvas ref={stagesRef} />
        </div>
        <div className="chart-card">
          <h3>Duration Trend</h3>
          <canvas ref={durationRef} />
        </div>
        <div className="chart-card">
          <h3>Readiness Score</h3>
          <canvas ref={readinessRef} />
        </div>
    </div>
  );
}
