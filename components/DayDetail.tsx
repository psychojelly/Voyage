'use client';

import { useMemo, useCallback } from 'react';
import type { DayRecord } from '@/lib/types';
import { SleepDonut, ActivityDonut, HRRangeBar } from './charts/DayCharts';

interface DayDetailProps {
  open: boolean;
  day: DayRecord | null;
  monthData: DayRecord[];
  onClose: () => void;
  onNavigate: (date: string) => void;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function pctDiff(value: number, avg: number): { text: string; cls: string } | null {
  if (!avg) return null;
  const diff = ((value - avg) / avg) * 100;
  const rounded = Math.round(Math.abs(diff));
  if (rounded === 0) return { text: 'avg', cls: 'neutral' };
  const direction = diff > 0 ? 'above' : 'below';
  return { text: `${rounded}% ${direction} avg`, cls: diff > 0 ? 'above' : 'below' };
}

export default function DayDetail({ open, day, monthData, onClose, onNavigate }: DayDetailProps) {
  // Days with any data, sorted by date
  const daysWithData = useMemo(() =>
    monthData.filter(d => d.sleep || d.heart || d.workout || d.stress).sort((a, b) => a.date.localeCompare(b.date)),
    [monthData],
  );

  const currentIndex = useMemo(() =>
    day ? daysWithData.findIndex(d => d.date === day.date) : -1,
    [day, daysWithData],
  );

  const goPrev = useCallback(() => {
    if (daysWithData.length === 0) return;
    const idx = currentIndex <= 0 ? daysWithData.length - 1 : currentIndex - 1;
    onNavigate(daysWithData[idx].date);
  }, [currentIndex, daysWithData, onNavigate]);

  const goNext = useCallback(() => {
    if (daysWithData.length === 0) return;
    const idx = currentIndex >= daysWithData.length - 1 ? 0 : currentIndex + 1;
    onNavigate(daysWithData[idx].date);
  }, [currentIndex, daysWithData, onNavigate]);

  // Monthly averages for comparison
  const avg = useMemo(() => {
    const sleepVals = monthData.map(d => d.sleep).filter(Boolean);
    const heartVals = monthData.map(d => d.heart).filter(Boolean);
    const workoutVals = monthData.map(d => d.workout).filter(Boolean);
    const sLen = sleepVals.length || 1;
    const hLen = heartVals.length || 1;
    const wLen = workoutVals.length || 1;
    return {
      duration: sleepVals.reduce((s, v) => s + (v!.duration_hours || 0), 0) / sLen,
      efficiency: sleepVals.reduce((s, v) => s + (v!.efficiency || 0), 0) / sLen,
      readiness: sleepVals.reduce((s, v) => s + (v!.readiness_score || 0), 0) / sLen,
      deep: sleepVals.reduce((s, v) => s + (v!.deep_min || 0), 0) / sLen,
      resting_hr: heartVals.reduce((s, v) => s + (v!.resting_hr || 0), 0) / hLen,
      hrv: heartVals.reduce((s, v) => s + (v!.hrv_avg || 0), 0) / hLen,
      steps: workoutVals.reduce((s, v) => s + (v!.steps || 0), 0) / wLen,
      calories: workoutVals.reduce((s, v) => s + (v!.calories_active || 0), 0) / wLen,
      active_min: workoutVals.reduce((s, v) => s + (v!.active_min || 0), 0) / wLen,
      activity_score: workoutVals.reduce((s, v) => s + (v!.activity_score || 0), 0) / wLen,
    };
  }, [monthData]);

  return (
    <>
      <div className={`day-detail-overlay${open ? ' active' : ''}`} onClick={onClose} />
      <div className={`day-detail-panel${open ? ' open' : ''}`}>
        <div className="day-header">
          <button className="day-nav-btn" onClick={goPrev} aria-label="Previous day">&larr;</button>
          <h2 className="day-date">{day ? formatDateLabel(day.date) : ''}</h2>
          <button className="day-nav-btn" onClick={goNext} aria-label="Next day">&rarr;</button>
          <button className="icon-btn day-close" aria-label="Close" onClick={onClose}>&times;</button>
        </div>

        {day && (
          <div className="day-body">
            {/* Sleep Section */}
            {day.sleep && (
              <div className="day-section">
                <h3 className="day-section-title sleep">Sleep</h3>
                <div className="day-stat-grid">
                  <StatCard label="Duration" value={`${day.sleep.duration_hours.toFixed(1)}h`} comparison={pctDiff(day.sleep.duration_hours, avg.duration)} />
                  <StatCard label="Efficiency" value={`${day.sleep.efficiency}%`} comparison={pctDiff(day.sleep.efficiency, avg.efficiency)} />
                  <StatCard label="Readiness" value={`${day.sleep.readiness_score}`} comparison={pctDiff(day.sleep.readiness_score, avg.readiness)} />
                  <StatCard label="Deep" value={`${day.sleep.deep_min}m`} comparison={pctDiff(day.sleep.deep_min, avg.deep)} />
                  <StatCard label="REM" value={`${day.sleep.rem_min}m`} />
                  <StatCard label="Light" value={`${day.sleep.light_min}m`} />
                  <StatCard label="Awake" value={`${day.sleep.awake_min}m`} />
                </div>
                <SleepDonut sleep={day.sleep} />
              </div>
            )}

            {/* Heart Section */}
            {day.heart && (
              <div className="day-section">
                <h3 className="day-section-title heart">Heart Rate</h3>
                <div className="day-stat-grid">
                  <StatCard label="Resting HR" value={`${day.heart.resting_hr}`} comparison={pctDiff(day.heart.resting_hr, avg.resting_hr)} />
                  <StatCard label="HRV" value={`${day.heart.hrv_avg}ms`} comparison={pctDiff(day.heart.hrv_avg, avg.hrv)} />
                  <StatCard label="Min HR" value={`${day.heart.hr_min}`} />
                  <StatCard label="Max HR" value={`${day.heart.hr_max}`} />
                </div>
                <HRRangeBar heart={day.heart} />
              </div>
            )}

            {/* Activity Section */}
            {day.workout && (
              <div className="day-section">
                <h3 className="day-section-title workout">Activity</h3>
                <div className="day-stat-grid">
                  <StatCard label="Steps" value={day.workout.steps.toLocaleString()} comparison={pctDiff(day.workout.steps, avg.steps)} />
                  <StatCard label="Calories" value={`${day.workout.calories_active}`} comparison={pctDiff(day.workout.calories_active, avg.calories)} />
                  <StatCard label="Active Min" value={`${day.workout.active_min}m`} comparison={pctDiff(day.workout.active_min, avg.active_min)} />
                  <StatCard label="Score" value={`${day.workout.activity_score}`} comparison={pctDiff(day.workout.activity_score, avg.activity_score)} />
                </div>
                <ActivityDonut workout={day.workout} />
              </div>
            )}

            {/* Stress Section */}
            {day.stress && (
              <div className="day-section">
                <h3 className="day-section-title stress">Stress</h3>
                <div className="day-stat-grid">
                  <StatCard label="High Stress" value={`${day.stress.stress_high}m`} />
                  <StatCard label="Recovery" value={`${day.stress.recovery_high}m`} />
                  <StatCard label="Summary" value={day.stress.day_summary} />
                </div>
              </div>
            )}

            {!day.sleep && !day.heart && !day.workout && !day.stress && (
              <p className="day-empty">No data recorded for this day.</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function StatCard({ label, value, comparison }: {
  label: string;
  value: string;
  comparison?: { text: string; cls: string } | null;
}) {
  return (
    <div className="day-stat-card">
      <span className="day-stat-value">{value}</span>
      <span className="day-stat-label">{label}</span>
      {comparison && (
        <span className={`day-comparison ${comparison.cls}`}>{comparison.text}</span>
      )}
    </div>
  );
}
