'use client';

import { useMemo, useCallback } from 'react';
import type { ChartConfiguration } from 'chart.js/auto';
import { useChartWithClick, getDayLabels } from './useChart';
import type { DayRecord } from '@/lib/types';

interface ActivityChartsProps {
  data: DayRecord[];
  onDayClick?: (date: string) => void;
}

export default function ActivityCharts({ data, onDayClick }: ActivityChartsProps) {
  const config = useMemo((): ChartConfiguration | null => {
    if (!data.length) return null;
    return {
      type: 'bar',
      data: {
        labels: getDayLabels(data),
        datasets: [{
          label: 'Active Calories',
          data: data.map(d => d.workout?.calories_active || null),
          backgroundColor: 'rgba(85, 239, 196, 0.5)',
          borderColor: '#55efc4',
          borderWidth: 1,
          borderRadius: 3,
        }],
      },
      options: {
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'kcal', color: '#55556a' },
          },
        },
      },
    };
  }, [data]);

  const handleClickIndex = useCallback((index: number) => {
    if (onDayClick && data[index]) onDayClick(data[index].date);
  }, [onDayClick, data]);

  const chartRef = useChartWithClick(config, handleClickIndex);

  return (
    <div className="charts-grid">
      <div className="chart-card">
        <h3>Active Calories</h3>
        {config ? (
          <canvas ref={chartRef} />
        ) : (
          <p className="overlay-fallback">No activity data available</p>
        )}
      </div>
    </div>
  );
}
