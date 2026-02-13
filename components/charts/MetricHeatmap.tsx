'use client';

import { useMemo } from 'react';
import Heatmap from './Heatmap';
import type { HeatmapRow } from './Heatmap';
import type { DayRecord } from '@/lib/types';

interface MetricHeatmapProps {
  data: DayRecord[];
}

export default function MetricHeatmap({ data }: MetricHeatmapProps) {
  const rows: HeatmapRow[] = useMemo(() => [
    { label: 'Steps', getValue: (d) => d.workout?.steps || 0 },
    { label: 'Calories', getValue: (d) => d.workout?.calories_active || 0 },
    { label: 'Active Min', getValue: (d) => d.workout?.active_min || 0 },
    { label: 'Score', getValue: (d) => d.workout?.activity_score || 0, max: 100 },
    { label: 'Resting HR', getValue: (d) => d.heart?.resting_hr || 0 },
    { label: 'HRV', getValue: (d) => d.heart?.hrv_avg || 0 },
  ], []);

  return <Heatmap data={data} rows={rows} colorScale="green" />;
}
