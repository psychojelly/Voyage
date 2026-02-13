'use client';

import { useMemo, useCallback } from 'react';
import type { ChartConfiguration } from 'chart.js/auto';
import { useChart, useChartWithClick, getDayLabels } from './useChart';
import type { DayRecord } from '@/lib/types';

interface HeartChartsProps {
  data: DayRecord[];
  onDayClick?: (date: string) => void;
}

export default function HeartCharts({ data, onDayClick }: HeartChartsProps) {
  const restingConfig = useMemo((): ChartConfiguration | null => {
    if (!data.length) return null;
    return {
      type: 'line',
      data: {
        labels: getDayLabels(data),
        datasets: [{
          label: 'Resting HR',
          data: data.map(d => d.heart?.resting_hr || null),
          borderColor: '#ff6b6b',
          backgroundColor: 'rgba(255, 107, 107, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#ff6b6b',
          spanGaps: true,
        }],
      },
      options: {
        scales: { y: { title: { display: true, text: 'BPM', color: '#55556a' } } },
      },
    };
  }, [data]);

  const hrvConfig = useMemo((): ChartConfiguration | null => {
    if (!data.length) return null;
    return {
      type: 'line',
      data: {
        labels: getDayLabels(data),
        datasets: [{
          label: 'HRV',
          data: data.map(d => d.heart?.hrv_avg || null),
          borderColor: '#fd79a8',
          backgroundColor: 'rgba(253, 121, 168, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#fd79a8',
          spanGaps: true,
        }],
      },
      options: {
        scales: { y: { title: { display: true, text: 'ms', color: '#55556a' } } },
      },
    };
  }, [data]);

  const rangeConfig = useMemo((): ChartConfiguration | null => {
    if (!data.length) return null;
    return {
      type: 'bar',
      data: {
        labels: getDayLabels(data),
        datasets: [
          {
            label: 'Min HR',
            data: data.map(d => d.heart?.hr_min || null),
            backgroundColor: 'rgba(255, 107, 107, 0.4)',
            borderColor: '#ff6b6b',
            borderWidth: 1,
          },
          {
            label: 'Max HR',
            data: data.map(d => d.heart?.hr_max || null),
            backgroundColor: 'rgba(253, 121, 168, 0.4)',
            borderColor: '#fd79a8',
            borderWidth: 1,
          },
        ],
      },
      options: {
        scales: { y: { title: { display: true, text: 'BPM', color: '#55556a' } } },
      },
    };
  }, [data]);

  const handleClickIndex = useCallback((index: number) => {
    if (onDayClick && data[index]) onDayClick(data[index].date);
  }, [onDayClick, data]);

  const restingRef = useChartWithClick(restingConfig, handleClickIndex);
  const hrvRef = useChart(hrvConfig);
  const rangeRef = useChart(rangeConfig);

  return (
    <div className="charts-grid">
        <div className="chart-card">
          <h3>Resting Heart Rate</h3>
          <canvas ref={restingRef} />
        </div>
        <div className="chart-card">
          <h3>Heart Rate Variability</h3>
          <canvas ref={hrvRef} />
        </div>
        <div className="chart-card">
          <h3>HR Range</h3>
          <canvas ref={rangeRef} />
        </div>
    </div>
  );
}
