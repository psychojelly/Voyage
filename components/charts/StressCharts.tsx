'use client';

import { useMemo, useCallback } from 'react';
import type { ChartConfiguration } from 'chart.js/auto';
import { useChart, useChartWithClick, getDayLabels } from './useChart';
import type { DayRecord } from '@/lib/types';

interface StressChartsProps {
  data: DayRecord[];
  onDayClick?: (date: string) => void;
}

export default function StressCharts({ data, onDayClick }: StressChartsProps) {
  const barConfig = useMemo((): ChartConfiguration | null => {
    if (!data.length) return null;
    const labels = getDayLabels(data);
    const stressVals = data.map(d => d.stress);
    return {
      type: 'bar' as const,
      data: {
        labels,
        datasets: [
          { label: 'High Stress', data: stressVals.map(v => (v?.stress_high || 0) / 60), backgroundColor: '#ffa500', stack: 'stack' },
          { label: 'Recovery', data: stressVals.map(v => (v?.recovery_high || 0) / 60), backgroundColor: '#55efc4', stack: 'stack' },
        ],
      },
      options: {
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { stacked: true },
          y: { stacked: true, max: 12, title: { display: true, text: 'Hours', color: '#55556a' } },
        },
      },
    };
  }, [data]);

  const trendConfig = useMemo((): ChartConfiguration | null => {
    if (!data.length) return null;
    return {
      type: 'line',
      data: {
        labels: getDayLabels(data),
        datasets: [{
          label: 'High Stress',
          data: data.map(d => (d.stress?.stress_high || 0) / 60),
          borderColor: '#ffa500',
          backgroundColor: 'rgba(255, 165, 0, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#ffa500',
        }],
      },
      options: {
        scales: { y: { min: 0, title: { display: true, text: 'Hours', color: '#55556a' } } },
      },
    };
  }, [data]);

  const doughnutConfig = useMemo((): ChartConfiguration | null => {
    if (!data.length) return null;
    const vals = data.map(d => d.stress).filter(Boolean);
    if (!vals.length) return null;
    const restored = vals.filter(v => v!.day_summary === 'restored').length;
    const normal = vals.filter(v => v!.day_summary === 'normal').length;
    const stressful = vals.filter(v => v!.day_summary === 'stressful').length;
    return {
      type: 'doughnut',
      data: {
        labels: ['Restored', 'Normal', 'Stressful'],
        datasets: [{
          data: [restored, normal, stressful],
          backgroundColor: ['#55efc4', '#74b9ff', '#ffa500'],
          borderWidth: 0,
        }],
      },
      options: {
        plugins: { legend: { position: 'bottom' } },
        scales: {},
      },
    };
  }, [data]);

  const handleClickIndex = useCallback((index: number) => {
    if (onDayClick && data[index]) onDayClick(data[index].date);
  }, [onDayClick, data]);

  const barRef = useChartWithClick(barConfig, handleClickIndex);
  const trendRef = useChart(trendConfig);
  const doughnutRef = useChart(doughnutConfig);

  return (
    <div className="charts-grid">
        <div className="chart-card">
          <h3>Stress vs Recovery</h3>
          <canvas ref={barRef} />
        </div>
        <div className="chart-card">
          <h3>Stress Trend</h3>
          <canvas ref={trendRef} />
        </div>
        <div className="chart-card">
          <h3>Day Summary</h3>
          <canvas ref={doughnutRef} />
        </div>
    </div>
  );
}
