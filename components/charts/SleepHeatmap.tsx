'use client';

import { useMemo } from 'react';
import Heatmap from './Heatmap';
import type { HeatmapRow } from './Heatmap';
import type { DayRecord } from '@/lib/types';

interface SleepHeatmapProps {
  data: DayRecord[];
}

export default function SleepHeatmap({ data }: SleepHeatmapProps) {
  const rows: HeatmapRow[] = useMemo(() => [
    { label: 'Duration', getValue: (d) => d.sleep?.duration_hours || 0, max: 10 },
    { label: 'Efficiency', getValue: (d) => d.sleep?.efficiency || 0, max: 100 },
    { label: 'Deep', getValue: (d) => d.sleep?.deep_min || 0, max: 120 },
    { label: 'REM', getValue: (d) => d.sleep?.rem_min || 0, max: 120 },
    { label: 'Light', getValue: (d) => d.sleep?.light_min || 0, max: 240 },
    { label: 'Readiness', getValue: (d) => d.sleep?.readiness_score || 0, max: 100 },
  ], []);

  return <Heatmap data={data} rows={rows} colorScale="blue" />;
}
