'use client';

import { useState, useMemo } from 'react';
import type { DayRecord, HealthGoal, GoalPeriod, Settings } from '@/lib/types';

const DEFAULT_GOALS: HealthGoal[] = [
  // Daily
  { metric: 'sleep_hours', label: 'Sleep', target: 8, unit: 'hrs', period: 'daily' },
  { metric: 'steps', label: 'Steps', target: 10000, unit: '', period: 'daily' },
  { metric: 'hrv_avg', label: 'HRV', target: 50, unit: 'ms', period: 'daily' },
  { metric: 'active_min', label: 'Active Minutes', target: 30, unit: 'min', period: 'daily' },
  { metric: 'readiness_score', label: 'Readiness', target: 80, unit: '', period: 'daily' },
  // Weekly
  { metric: 'steps', label: 'Weekly Steps', target: 70000, unit: '', period: 'weekly' },
  { metric: 'active_min', label: 'Weekly Active', target: 150, unit: 'min', period: 'weekly' },
  { metric: 'sleep_hours', label: 'Avg Sleep', target: 7.5, unit: 'hrs', period: 'weekly' },
  // Monthly
  { metric: 'steps', label: 'Monthly Steps', target: 300000, unit: '', period: 'monthly' },
  { metric: 'sleep_hours', label: 'Avg Sleep', target: 7.5, unit: 'hrs', period: 'monthly' },
];

const AVAILABLE_METRICS: { value: string; label: string; unit: string; defaults: Record<GoalPeriod, number> }[] = [
  { value: 'sleep_hours', label: 'Sleep Duration', unit: 'hrs', defaults: { daily: 8, weekly: 7.5, monthly: 7.5 } },
  { value: 'steps', label: 'Steps', unit: '', defaults: { daily: 10000, weekly: 70000, monthly: 300000 } },
  { value: 'hrv_avg', label: 'HRV Average', unit: 'ms', defaults: { daily: 50, weekly: 50, monthly: 50 } },
  { value: 'active_min', label: 'Active Minutes', unit: 'min', defaults: { daily: 30, weekly: 150, monthly: 600 } },
  { value: 'readiness_score', label: 'Readiness Score', unit: '', defaults: { daily: 80, weekly: 80, monthly: 80 } },
  { value: 'resting_hr', label: 'Resting Heart Rate', unit: 'bpm', defaults: { daily: 60, weekly: 60, monthly: 60 } },
  { value: 'calories_active', label: 'Active Calories', unit: 'kcal', defaults: { daily: 500, weekly: 3500, monthly: 15000 } },
  { value: 'deep_min', label: 'Deep Sleep', unit: 'min', defaults: { daily: 60, weekly: 60, monthly: 60 } },
  { value: 'rem_min', label: 'REM Sleep', unit: 'min', defaults: { daily: 90, weekly: 90, monthly: 90 } },
  { value: 'sleep_efficiency', label: 'Sleep Efficiency', unit: '%', defaults: { daily: 85, weekly: 85, monthly: 85 } },
];

// Metrics where we sum over a period (rest are averaged)
const SUM_METRICS = new Set(['steps', 'active_min', 'calories_active']);
// Lower is better
const LOWER_IS_BETTER = new Set(['resting_hr']);

function extractMetric(day: DayRecord, metric: string): number | null {
  switch (metric) {
    case 'sleep_hours': return day.sleep?.duration_hours ?? null;
    case 'steps': return day.workout?.steps ?? null;
    case 'hrv_avg': return day.heart?.hrv_avg ?? null;
    case 'active_min': return day.workout?.active_min ?? null;
    case 'readiness_score': return day.sleep?.readiness_score ?? null;
    case 'resting_hr': return day.heart?.resting_hr ?? null;
    case 'calories_active': return day.workout?.calories_active ?? null;
    case 'deep_min': return day.sleep?.deep_min ?? null;
    case 'rem_min': return day.sleep?.rem_min ?? null;
    case 'sleep_efficiency': return day.sleep?.efficiency ?? null;
    default: return null;
  }
}

/** Get the Monday..Sunday date range for the week containing focusDate */
function getWeekRange(focusDate: string): { start: string; end: string } {
  const d = new Date(focusDate + 'T12:00:00');
  const dow = d.getDay(); // 0=Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: fmtDate(monday), end: fmtDate(sunday) };
}

/** Get 1st..last of the month containing focusDate */
function getMonthRange(focusDate: string): { start: string; end: string } {
  const d = new Date(focusDate + 'T12:00:00');
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: fmtDate(first), end: fmtDate(last) };
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Aggregate metric values over a set of days */
function aggregateMetric(days: DayRecord[], metric: string): number | null {
  const vals = days.map(d => extractMetric(d, metric)).filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  if (SUM_METRICS.has(metric)) return vals.reduce((a, b) => a + b, 0);
  return vals.reduce((a, b) => a + b, 0) / vals.length; // average
}

function computeGoalResult(
  goal: HealthGoal,
  value: number | null,
  periodLabel: string,
  daysInPeriod: number,
) {
  const lowerBetter = LOWER_IS_BETTER.has(goal.metric);
  const pct = value !== null
    ? lowerBetter
      ? Math.min(100, Math.round((goal.target / value) * 100))
      : Math.min(100, Math.round((value / goal.target) * 100))
    : 0;
  const hit = value !== null && (lowerBetter ? value <= goal.target : value >= goal.target);

  return { ...goal, value, pct, hit, periodLabel, daysInPeriod };
}

interface GoalsPanelProps {
  data: DayRecord[];
  focusDay: DayRecord | null;
  focusDate: string;
  settings: Settings;
  onUpdateSettings: (patch: Partial<Settings>) => void;
}

export default function GoalsPanel({ data, focusDay, focusDate, settings, onUpdateSettings }: GoalsPanelProps) {
  const goals = settings.goals ?? DEFAULT_GOALS;
  const [editing, setEditing] = useState(false);
  const [editGoals, setEditGoals] = useState<HealthGoal[]>(goals);
  const [addMetric, setAddMetric] = useState('');
  const [addPeriod, setAddPeriod] = useState<GoalPeriod>('daily');

  const dailyGoals = goals.filter(g => g.period === 'daily');
  const weeklyGoals = goals.filter(g => g.period === 'weekly');
  const monthlyGoals = goals.filter(g => g.period === 'monthly');

  // Date ranges
  const weekRange = useMemo(() => getWeekRange(focusDate), [focusDate]);
  const monthRange = useMemo(() => getMonthRange(focusDate), [focusDate]);

  // Filter data for each period
  const weekData = useMemo(
    () => data.filter(d => d.date >= weekRange.start && d.date <= weekRange.end),
    [data, weekRange],
  );
  const monthData = useMemo(
    () => data.filter(d => d.date >= monthRange.start && d.date <= monthRange.end),
    [data, monthRange],
  );

  // Daily results (same as before + streaks)
  const dailyResults = useMemo(() => {
    const sorted = [...data]
      .filter(d => d.date <= focusDate)
      .sort((a, b) => b.date.localeCompare(a.date));
    const chronological = [...data].sort((a, b) => a.date.localeCompare(b.date));

    return dailyGoals.map(goal => {
      const lowerBetter = LOWER_IS_BETTER.has(goal.metric);
      const r = computeGoalResult(goal, focusDay ? extractMetric(focusDay, goal.metric) : null, '', 1);

      // Current streak
      let streak = 0;
      for (const day of sorted) {
        const val = extractMetric(day, goal.metric);
        if (val === null) break;
        if (lowerBetter ? val <= goal.target : val >= goal.target) streak++;
        else break;
      }

      // Best streak
      let bestStreak = 0;
      let run = 0;
      for (const day of chronological) {
        const val = extractMetric(day, goal.metric);
        if (val === null) { run = 0; continue; }
        if (lowerBetter ? val <= goal.target : val >= goal.target) { run++; bestStreak = Math.max(bestStreak, run); }
        else run = 0;
      }

      const daysHit = data.filter(day => {
        const val = extractMetric(day, goal.metric);
        return val !== null && (lowerBetter ? val <= goal.target : val >= goal.target);
      }).length;

      return { ...r, streak, bestStreak, daysHit, totalDays: data.length };
    });
  }, [dailyGoals, data, focusDay, focusDate]);

  // Weekly results
  const weeklyResults = useMemo(
    () => weeklyGoals.map(goal =>
      computeGoalResult(goal, aggregateMetric(weekData, goal.metric), `${weekRange.start} – ${weekRange.end}`, weekData.length),
    ),
    [weeklyGoals, weekData, weekRange],
  );

  // Monthly results
  const monthlyResults = useMemo(
    () => monthlyGoals.map(goal =>
      computeGoalResult(goal, aggregateMetric(monthData, goal.metric), `${monthRange.start} – ${monthRange.end}`, monthData.length),
    ),
    [monthlyGoals, monthData, monthRange],
  );

  const focusDateLabel = focusDate === new Date().toISOString().slice(0, 10)
    ? "Today's"
    : new Date(focusDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const weekLabel = (() => {
    const s = new Date(weekRange.start + 'T12:00:00');
    const e = new Date(weekRange.end + 'T12:00:00');
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}`;
  })();

  const monthLabel = (() => {
    const d = new Date(focusDate + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  })();

  // Editor handlers
  const handleSaveGoals = () => {
    onUpdateSettings({ goals: editGoals });
    setEditing(false);
  };

  const handleAddGoal = () => {
    if (!addMetric) return;
    const meta = AVAILABLE_METRICS.find(m => m.value === addMetric);
    if (!meta) return;
    // Allow same metric in different periods
    if (editGoals.some(g => g.metric === addMetric && g.period === addPeriod)) return;
    const label = addPeriod === 'daily'
      ? meta.label
      : `${addPeriod === 'weekly' ? 'Weekly' : 'Monthly'} ${meta.label}`;
    setEditGoals([...editGoals, {
      metric: meta.value,
      label,
      target: meta.defaults[addPeriod],
      unit: meta.unit,
      period: addPeriod,
    }]);
    setAddMetric('');
  };

  const handleRemoveGoal = (idx: number) => {
    setEditGoals(editGoals.filter((_, i) => i !== idx));
  };

  const handleTargetChange = (idx: number, target: number) => {
    setEditGoals(editGoals.map((g, i) => i === idx ? { ...g, target } : g));
  };

  return (
    <div className="goals-panel">
      <div className="goals-header">
        <h2 className="goals-title">Goals</h2>
        <button
          className="btn btn-secondary goals-edit-btn"
          onClick={() => {
            if (editing) handleSaveGoals();
            else { setEditGoals(goals); setEditing(true); }
          }}
        >
          {editing ? 'Save' : 'Edit Goals'}
        </button>
        {editing && (
          <button className="btn btn-secondary goals-edit-btn" onClick={() => setEditing(false)}>Cancel</button>
        )}
      </div>

      {editing ? (
        <div className="goals-editor">
          {(['daily', 'weekly', 'monthly'] as GoalPeriod[]).map(period => {
            const periodGoals = editGoals
              .map((g, idx) => ({ ...g, _idx: idx }))
              .filter(g => g.period === period);
            if (periodGoals.length === 0) return null;
            return (
              <div key={period} className="goals-editor-section">
                <h4 className="goals-editor-period">{period.charAt(0).toUpperCase() + period.slice(1)}</h4>
                {periodGoals.map(goal => (
                  <div key={goal._idx} className="goal-edit-row">
                    <span className="goal-edit-label">{goal.label}</span>
                    <input
                      type="number"
                      className="goal-edit-input"
                      value={goal.target}
                      onChange={e => handleTargetChange(goal._idx, Number(e.target.value))}
                    />
                    <span className="goal-edit-unit">{goal.unit}</span>
                    <button className="goal-remove-btn" onClick={() => handleRemoveGoal(goal._idx)}>&times;</button>
                  </div>
                ))}
              </div>
            );
          })}
          <div className="goal-add-row">
            <select className="goal-add-period" value={addPeriod} onChange={e => setAddPeriod(e.target.value as GoalPeriod)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <select value={addMetric} onChange={e => setAddMetric(e.target.value)}>
              <option value="">Add metric...</option>
              {AVAILABLE_METRICS
                .filter(m => !editGoals.some(g => g.metric === m.value && g.period === addPeriod))
                .map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
            </select>
            <button className="btn btn-primary goal-add-btn" onClick={handleAddGoal} disabled={!addMetric}>Add</button>
          </div>
        </div>
      ) : (
        <>
          {/* Daily Progress */}
          {dailyResults.length > 0 && (
            <div className="goals-section">
              <h3 className="goals-section-title">{focusDateLabel} Progress</h3>
              <div className="goals-grid">
                {dailyResults.map((g, i) => (
                  <div key={i} className={`goal-card ${g.hit ? 'goal-hit' : ''}`}>
                    <div className="goal-card-header">
                      <span className="goal-card-label">{g.label}</span>
                      {g.hit && <span className="goal-check">&#10003;</span>}
                    </div>
                    <div className="goal-progress-bar">
                      <div className="goal-progress-fill" style={{ width: `${g.pct}%` }} />
                    </div>
                    <div className="goal-card-values">
                      <span className="goal-current">{g.value !== null ? formatValue(g.value, g.unit) : '--'}</span>
                      <span className="goal-target">/ {formatValue(g.target, g.unit)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weekly Progress */}
          {weeklyResults.length > 0 && (
            <div className="goals-section">
              <h3 className="goals-section-title">Week of {weekLabel}</h3>
              <span className="goals-section-subtitle">{weekData.length} day{weekData.length !== 1 ? 's' : ''} of data</span>
              <div className="goals-grid">
                {weeklyResults.map((g, i) => (
                  <div key={i} className={`goal-card ${g.hit ? 'goal-hit' : ''}`}>
                    <div className="goal-card-header">
                      <span className="goal-card-label">{g.label}</span>
                      {g.hit && <span className="goal-check">&#10003;</span>}
                    </div>
                    <div className="goal-progress-bar">
                      <div className="goal-progress-fill goal-fill-weekly" style={{ width: `${g.pct}%` }} />
                    </div>
                    <div className="goal-card-values">
                      <span className="goal-current">{g.value !== null ? formatValue(g.value, g.unit) : '--'}</span>
                      <span className="goal-target">/ {formatValue(g.target, g.unit)}</span>
                      <span className="goal-agg-hint">{SUM_METRICS.has(g.metric) ? 'total' : 'avg'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly Progress */}
          {monthlyResults.length > 0 && (
            <div className="goals-section">
              <h3 className="goals-section-title">{monthLabel}</h3>
              <span className="goals-section-subtitle">{monthData.length} day{monthData.length !== 1 ? 's' : ''} of data</span>
              <div className="goals-grid">
                {monthlyResults.map((g, i) => (
                  <div key={i} className={`goal-card ${g.hit ? 'goal-hit' : ''}`}>
                    <div className="goal-card-header">
                      <span className="goal-card-label">{g.label}</span>
                      {g.hit && <span className="goal-check">&#10003;</span>}
                    </div>
                    <div className="goal-progress-bar">
                      <div className="goal-progress-fill goal-fill-monthly" style={{ width: `${g.pct}%` }} />
                    </div>
                    <div className="goal-card-values">
                      <span className="goal-current">{g.value !== null ? formatValue(g.value, g.unit) : '--'}</span>
                      <span className="goal-target">/ {formatValue(g.target, g.unit)}</span>
                      <span className="goal-agg-hint">{SUM_METRICS.has(g.metric) ? 'total' : 'avg'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Streaks (daily goals only) */}
          {dailyResults.length > 0 && (
            <div className="goals-section">
              <h3 className="goals-section-title">Streaks</h3>
              <div className="streaks-grid">
                {dailyResults.map((g, i) => (
                  <div key={i} className="streak-card">
                    <span className="streak-label">{g.label}</span>
                    <div className="streak-values">
                      <div className="streak-stat">
                        <span className={`streak-number ${g.streak > 0 ? 'active' : ''}`}>{g.streak}</span>
                        <span className="streak-caption">Current</span>
                      </div>
                      <div className="streak-stat">
                        <span className="streak-number best">{g.bestStreak}</span>
                        <span className="streak-caption">Best</span>
                      </div>
                      <div className="streak-stat">
                        <span className="streak-number">{g.daysHit}/{g.totalDays}</span>
                        <span className="streak-caption">Hit Rate</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function formatValue(val: number, unit: string): string {
  if (unit === 'hrs') return `${val.toFixed(1)}${unit}`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
  return `${Math.round(val)}${unit ? ` ${unit}` : ''}`;
}
