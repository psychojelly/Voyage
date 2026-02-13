'use client';

import { useMemo, useState } from 'react';
import type { DayRecord } from '@/lib/types';

export interface HeatmapRow {
  label: string;
  getValue: (d: DayRecord) => number;
  max?: number;
}

interface HeatmapProps {
  data: DayRecord[];
  rows: HeatmapRow[];
  colorScale: 'blue' | 'green' | 'red' | 'orange';
}

const COLOR_MAP: Record<string, [number, number, number]> = {
  blue: [116, 185, 255],
  green: [85, 239, 196],
  red: [255, 107, 107],
  orange: [255, 165, 0],
};

export default function Heatmap({ data, rows, colorScale }: HeatmapProps) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  const dayNumbers = useMemo(() => data.map(d => parseInt(d.date.slice(8), 10)), [data]);

  const computedRows = useMemo(() => {
    return rows.map(row => {
      const values = data.map(d => row.getValue(d));
      const max = row.max ?? Math.max(...values, 1);
      return { label: row.label, values, max };
    });
  }, [data, rows]);

  const rgb = COLOR_MAP[colorScale];

  if (!data.length) {
    return <div className="heatmap-container"><p style={{ color: 'var(--text-muted)' }}>No data to display</p></div>;
  }

  return (
    <div className="heatmap-container">
      <div className="heatmap-grid" style={{ gridTemplateColumns: `80px repeat(${data.length}, 1fr)` }}>
        {/* Day labels header row */}
        <div className="heatmap-corner" />
        {dayNumbers.map((day, i) => (
          <div key={i} className="heatmap-day-label">{day}</div>
        ))}

        {/* Data rows */}
        {computedRows.map((row, ri) => (
          <>
            <div key={`label-${ri}`} className="heatmap-row-label">{row.label}</div>
            {row.values.map((val, ci) => {
              const normalized = row.max > 0 ? Math.min(val / row.max, 1) : 0;
              const alpha = val > 0 ? 0.1 + normalized * 0.8 : 0.03;
              return (
                <div
                  key={`${ri}-${ci}`}
                  className="heatmap-cell"
                  style={{ backgroundColor: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})` }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltip({
                      text: `${row.label}: ${Math.round(val)} (Day ${dayNumbers[ci]})`,
                      x: rect.left + rect.width / 2,
                      y: rect.top - 8,
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })}
          </>
        ))}
      </div>

      {tooltip && (
        <div
          className="heatmap-tooltip"
          style={{ position: 'fixed', left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
