'use client';

import { useMemo, useState } from 'react';
import type { ChartConfiguration } from 'chart.js/auto';
import { useChart } from './useChart';
import { formatHour } from '@/lib/intraday-utils';
import type { WeatherHourly } from '@/lib/types';

interface WeatherIntradayProps {
  date: string;
  hourly: WeatherHourly | null;
}

const METRICS = [
  { key: 'temp', label: 'Temp', color: '#ff7675', unit: '\u00B0C', yAxisId: 'yTemp' },
  { key: 'humidity', label: 'Humidity', color: '#81ecec', unit: '%', yAxisId: 'yHumidity' },
  { key: 'rain', label: 'Rain', color: '#74b9ff', unit: 'mm', yAxisId: 'yRain' },
  { key: 'wind', label: 'Wind', color: '#a29bfe', unit: 'km/h', yAxisId: 'yWind' },
  { key: 'uv', label: 'UV', color: '#fdcb6e', unit: '', yAxisId: 'yUV' },
] as const;

type MetricKey = typeof METRICS[number]['key'];

export default function WeatherIntraday({ date, hourly }: WeatherIntradayProps) {
  const [activeMetrics, setActiveMetrics] = useState<Set<MetricKey>>(
    new Set(['temp', 'humidity', 'uv']),
  );

  const toggleMetric = (key: MetricKey) => {
    setActiveMetrics(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Parse hourly timestamps into decimal hours
  const hours = useMemo(() => {
    if (!hourly?.time?.length) return [];
    return hourly.time.map(t => {
      const d = new Date(t);
      return d.getHours() + d.getMinutes() / 60;
    });
  }, [hourly]);

  const config = useMemo((): ChartConfiguration | null => {
    if (!hourly || !hours.length) return null;
    if (activeMetrics.size === 0) return null;

    const dataMap: Record<MetricKey, (number | null)[]> = {
      temp: hourly.temperature_2m,
      humidity: hourly.relative_humidity_2m,
      rain: hourly.precipitation,
      wind: hourly.windspeed_10m,
      uv: hourly.uv_index,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const datasets: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scales: Record<string, any> = {
      x: {
        type: 'linear',
        min: 0,
        max: 24,
        ticks: {
          stepSize: 3,
          callback: (val: unknown) => formatHour(val as number),
          color: '#55556a',
          font: { size: 10 },
        },
        grid: { color: 'rgba(42, 42, 64, 0.5)' },
      },
    };

    let axisCount = 0;
    for (const metric of METRICS) {
      if (!activeMetrics.has(metric.key)) continue;

      const points = hours
        .map((h, i) => ({ x: h, y: dataMap[metric.key][i] }))
        .filter((p): p is { x: number; y: number } => p.y != null);

      if (points.length === 0) continue;

      datasets.push({
        label: metric.label,
        data: points,
        borderColor: metric.color,
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
        tension: 0.3,
        yAxisID: metric.yAxisId,
      });

      const position = axisCount % 2 === 0 ? 'left' : 'right';
      scales[metric.yAxisId] = {
        position,
        ticks: { color: metric.color, font: { size: 10 } },
        title: { display: true, text: metric.unit, color: metric.color, font: { size: 10 } },
        grid: { drawOnChartArea: axisCount === 0, color: 'rgba(42, 42, 64, 0.3)' },
        ...(metric.key === 'humidity' ? { min: 0, max: 100 } : {}),
        ...(metric.key === 'rain' || metric.key === 'uv' ? { beginAtZero: true } : {}),
      };
      axisCount++;
    }

    if (datasets.length === 0) return null;

    return {
      type: 'line',
      data: { datasets },
      options: {
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const item = items[0];
                if (!item) return '';
                return formatHour(item.parsed.x ?? 0);
              },
              label: (item) => {
                const label = item.dataset.label || '';
                const y = item.parsed.y ?? 0;
                const m = METRICS.find(mt => mt.label === label);
                return `${label}: ${y.toFixed(1)}${m?.unit ? ' ' + m.unit : ''}`;
              },
            },
          },
        },
        scales,
      },
    };
  }, [hourly, hours, activeMetrics]);

  const canvasRef = useChart(config);

  const dateLabel = date
    ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      })
    : '';

  return (
    <div className="day-intraday">
      <div className="overlay-chart-card">
        <div className="intraday-header">
          <h3>Weather 24-Hour View{dateLabel ? ` \u2014 ${dateLabel}` : ''}</h3>
          <div className="intraday-toggles">
            {METRICS.map(m => (
              <button
                key={m.key}
                className={`intraday-toggle${activeMetrics.has(m.key) ? ' active' : ''}`}
                style={{ '--toggle-color': m.color } as React.CSSProperties}
                onClick={() => toggleMetric(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {config ? (
          <canvas ref={canvasRef} />
        ) : (
          <p className="overlay-fallback">
            {!hourly ? 'Loading hourly weather data...' : 'Select a metric to display'}
          </p>
        )}
      </div>
    </div>
  );
}
