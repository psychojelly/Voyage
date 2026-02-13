'use client';

import { useMemo, useCallback } from 'react';
import type { ChartConfiguration } from 'chart.js/auto';
import { useChart, useChartWithClick, getDayLabels } from './useChart';
import type { WeatherDay } from '@/lib/types';

interface WeatherChartsProps {
  data: WeatherDay[];
  onDayClick?: (date: string) => void;
}

export default function WeatherCharts({ data, onDayClick }: WeatherChartsProps) {
  const handleClickIndex = useCallback((index: number) => {
    if (onDayClick && data[index]) onDayClick(data[index].date);
  }, [onDayClick, data]);

  // Temperature: high/low range
  const tempConfig = useMemo((): ChartConfiguration | null => {
    if (!data.length) return null;
    return {
      type: 'line',
      data: {
        labels: getDayLabels(data),
        datasets: [
          {
            label: 'High',
            data: data.map(d => d.temperature_max),
            borderColor: '#ff7675',
            backgroundColor: 'rgba(255, 118, 117, 0.15)',
            fill: '+1',
            tension: 0.4,
            pointRadius: 3,
            pointBackgroundColor: '#ff7675',
          },
          {
            label: 'Low',
            data: data.map(d => d.temperature_min),
            borderColor: '#74b9ff',
            backgroundColor: 'rgba(116, 185, 255, 0.15)',
            fill: false,
            tension: 0.4,
            pointRadius: 3,
            pointBackgroundColor: '#74b9ff',
          },
        ],
      },
      options: {
        plugins: { legend: { position: 'bottom' } },
        scales: {
          y: { title: { display: true, text: '\u00B0C', color: '#55556a' } },
        },
      },
    };
  }, [data]);

  // Precipitation: bar
  const precipConfig = useMemo((): ChartConfiguration | null => {
    if (!data.length) return null;
    return {
      type: 'bar',
      data: {
        labels: getDayLabels(data),
        datasets: [{
          label: 'Rain',
          data: data.map(d => d.precipitation_sum),
          backgroundColor: 'rgba(116, 185, 255, 0.5)',
          borderColor: '#74b9ff',
          borderWidth: 1,
          borderRadius: 3,
        }],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'mm', color: '#55556a' },
          },
        },
      },
    };
  }, [data]);

  // Humidity: line
  const humidityConfig = useMemo((): ChartConfiguration | null => {
    if (!data.length) return null;
    return {
      type: 'line',
      data: {
        labels: getDayLabels(data),
        datasets: [{
          label: 'Humidity',
          data: data.map(d => d.humidity_mean),
          borderColor: '#81ecec',
          backgroundColor: 'rgba(129, 236, 236, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#81ecec',
        }],
      },
      options: {
        scales: {
          y: {
            min: 0,
            max: 100,
            title: { display: true, text: '%', color: '#55556a' },
          },
        },
      },
    };
  }, [data]);

  // Wind speed: line
  const windConfig = useMemo((): ChartConfiguration | null => {
    if (!data.length) return null;
    return {
      type: 'line',
      data: {
        labels: getDayLabels(data),
        datasets: [{
          label: 'Max Wind',
          data: data.map(d => d.windspeed_max),
          borderColor: '#a29bfe',
          backgroundColor: 'rgba(162, 155, 254, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#a29bfe',
        }],
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'km/h', color: '#55556a' },
          },
        },
      },
    };
  }, [data]);

  // UV Index: line
  const uvConfig = useMemo((): ChartConfiguration | null => {
    if (!data.length) return null;
    return {
      type: 'line',
      data: {
        labels: getDayLabels(data),
        datasets: [{
          label: 'UV Index',
          data: data.map(d => d.uv_index_max),
          borderColor: '#fdcb6e',
          backgroundColor: 'rgba(253, 203, 110, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#fdcb6e',
        }],
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'UV', color: '#55556a' },
          },
        },
      },
    };
  }, [data]);

  // Pollen: stacked bar by species
  const pollenConfig = useMemo((): ChartConfiguration | null => {
    if (!data.length) return null;
    return {
      type: 'bar',
      data: {
        labels: getDayLabels(data),
        datasets: [
          {
            label: 'Alder',
            data: data.map(d => d.pollen_alder ?? 0),
            backgroundColor: '#00b894',
            stack: 'pollen',
          },
          {
            label: 'Birch',
            data: data.map(d => d.pollen_birch ?? 0),
            backgroundColor: '#55efc4',
            stack: 'pollen',
          },
          {
            label: 'Olive',
            data: data.map(d => d.pollen_olive ?? 0),
            backgroundColor: '#00cec9',
            stack: 'pollen',
          },
          {
            label: 'Grass',
            data: data.map(d => d.pollen_grass ?? 0),
            backgroundColor: '#ffeaa7',
            stack: 'pollen',
          },
          {
            label: 'Mugwort',
            data: data.map(d => d.pollen_mugwort ?? 0),
            backgroundColor: '#fab1a0',
            stack: 'pollen',
          },
          {
            label: 'Ragweed',
            data: data.map(d => d.pollen_ragweed ?? 0),
            backgroundColor: '#e17055',
            stack: 'pollen',
          },
        ],
      },
      options: {
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { stacked: true },
          y: {
            stacked: true,
            beginAtZero: true,
            title: { display: true, text: 'grains/m\u00B3', color: '#55556a' },
          },
        },
      },
    };
  }, [data]);

  const tempRef = useChartWithClick(tempConfig, handleClickIndex);
  const precipRef = useChart(precipConfig);
  const humidityRef = useChart(humidityConfig);
  const windRef = useChart(windConfig);
  const uvRef = useChart(uvConfig);
  const pollenRef = useChart(pollenConfig);

  if (!data.length) {
    return (
      <div className="charts-grid">
        <div className="chart-card">
          <p className="overlay-fallback">No weather data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="charts-grid">
      <div className="chart-card">
        <h3>Temperature (High / Low)</h3>
        <canvas ref={tempRef} />
      </div>
      <div className="chart-card">
        <h3>Precipitation</h3>
        <canvas ref={precipRef} />
      </div>
      <div className="chart-card">
        <h3>Humidity</h3>
        <canvas ref={humidityRef} />
      </div>
      <div className="chart-card">
        <h3>Wind Speed</h3>
        <canvas ref={windRef} />
      </div>
      <div className="chart-card">
        <h3>UV Index</h3>
        <canvas ref={uvRef} />
      </div>
      {pollenConfig && (
        <div className="chart-card">
          <h3>Pollen Count</h3>
          <canvas ref={pollenRef} />
        </div>
      )}
    </div>
  );
}
