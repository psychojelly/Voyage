'use client';

import { useMemo, useCallback } from 'react';
import type { ChartConfiguration } from 'chart.js/auto';
import { useChart, useChartWithClick, getDayLabels } from './useChart';
import type { DayRecord } from '@/lib/types';

interface WorkoutChartsProps {
  data: DayRecord[];
  onDayClick?: (date: string) => void;
}

export default function WorkoutCharts({ data, onDayClick }: WorkoutChartsProps) {
  const stepsConfig = useMemo((): ChartConfiguration | null => {
    if (!data.length) return null;
    const steps = data.map(d => d.workout?.steps || 0);
    return {
      type: 'bar',
      data: {
        labels: getDayLabels(data),
        datasets: [{
          label: 'Steps',
          data: steps,
          backgroundColor: steps.map(s => s >= 10000
            ? 'rgba(85, 239, 196, 0.7)'
            : s >= 7000
              ? 'rgba(85, 239, 196, 0.4)'
              : 'rgba(85, 239, 196, 0.2)'),
          borderColor: '#55efc4',
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { title: { display: true, text: 'Steps', color: '#55556a' } } },
      },
    };
  }, [data]);

  const caloriesConfig = useMemo((): ChartConfiguration | null => {
    if (!data.length) return null;
    return {
      type: 'line',
      data: {
        labels: getDayLabels(data),
        datasets: [{
          label: 'Active Calories',
          data: data.map(d => d.workout?.calories_active || 0),
          borderColor: '#55efc4',
          backgroundColor: 'rgba(85, 239, 196, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#55efc4',
        }],
      },
      options: {
        scales: { y: { title: { display: true, text: 'kcal', color: '#55556a' } } },
      },
    };
  }, [data]);

  const activeConfig = useMemo((): ChartConfiguration | null => {
    if (!data.length) return null;
    return {
      type: 'bar',
      data: {
        labels: getDayLabels(data),
        datasets: [{
          label: 'Active Minutes',
          data: data.map(d => d.workout?.active_min || 0),
          backgroundColor: 'rgba(0, 206, 209, 0.5)',
          borderColor: '#00cec9',
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { title: { display: true, text: 'Minutes', color: '#55556a' } } },
      },
    };
  }, [data]);

  const handleClickIndex = useCallback((index: number) => {
    if (onDayClick && data[index]) onDayClick(data[index].date);
  }, [onDayClick, data]);

  const stepsRef = useChartWithClick(stepsConfig, handleClickIndex);
  const caloriesRef = useChart(caloriesConfig);
  const activeRef = useChart(activeConfig);

  return (
    <div className="charts-grid">
        <div className="chart-card">
          <h3>Daily Steps</h3>
          <canvas ref={stepsRef} />
        </div>
        <div className="chart-card">
          <h3>Active Calories</h3>
          <canvas ref={caloriesRef} />
        </div>
        <div className="chart-card">
          <h3>Active Minutes</h3>
          <canvas ref={activeRef} />
        </div>
    </div>
  );
}
