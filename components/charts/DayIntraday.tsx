'use client';

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import type { ChartConfiguration } from 'chart.js/auto';
import { useChart } from './useChart';
import { parsePipeString, mapToClockHours, formatHour } from '@/lib/intraday-utils';
import { detectWorkoutEvents } from '@/lib/event-detector';
import { createEventMarkerPlugin, type MarkerHitbox } from './eventMarkerPlugin';
import EventPopup from './EventPopup';
import EventForm from './EventForm';
import { useStore } from '@/lib/store-provider';
import type { DayRecord, HealthEvent } from '@/lib/types';

const STAGE_LABELS: Record<number, string> = { 1: 'Deep', 2: 'Light', 3: 'REM', 4: 'Awake' };

type ViewMode = 'full' | 'sleep-effector';

interface DayIntradayProps {
  day: DayRecord | null;
  prevDay?: DayRecord | null;
  onDayUpdated?: () => void;
  gcalEvents?: HealthEvent[];
  readOnly?: boolean;
  autoDream?: boolean;
}

export default function DayIntraday({ day, prevDay, onDayUpdated, gcalEvents = [], readOnly, autoDream }: DayIntradayProps) {
  const store = useStore();
  const [showSleep, setShowSleep] = useState(true);
  const [showHeart, setShowHeart] = useState(true);
  const [showActivity, setShowActivity] = useState(true);
  const [startHour, setStartHour] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('full');

  // Event state
  const [activePopup, setActivePopup] = useState<{ event: HealthEvent; x: number; y: number } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [dreamMode, setDreamMode] = useState(false);
  const [editingEvent, setEditingEvent] = useState<HealthEvent | null>(null);

  const markerHitboxes = useRef<MarkerHitbox[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);

  // Auto-open dream form when autoDream prop becomes true
  useEffect(() => {
    if (autoDream) {
      setShowForm(true);
      setDreamMode(true);
      setEditingEvent(null);
    }
  }, [autoDream]);

  const effectiveStart = viewMode === 'sleep-effector' ? 8 : startHour;

  // Compute combined events (manual + auto-detected)
  const allEvents = useMemo(() => {
    if (!day) return [];
    const manual = day.events || [];
    const autoCurrent = detectWorkoutEvents(day.workout, day.date);

    if (viewMode === 'sleep-effector' && prevDay) {
      const autoPrev = detectWorkoutEvents(prevDay.workout, prevDay.date);
      // For sleep effector: prev day events from 8:00+ and current day events
      const prevManual = (prevDay.events || []).filter(e => {
        const h = parseInt(e.time.split(':')[0], 10);
        return h >= 8;
      });
      const prevAuto = autoPrev.filter(e => {
        const h = parseInt(e.time.split(':')[0], 10);
        return h >= 8;
      });
      return [...prevManual, ...prevAuto, ...manual, ...autoCurrent, ...gcalEvents];
    }

    return [...manual, ...autoCurrent, ...gcalEvents];
  }, [day, prevDay, viewMode, gcalEvents]);

  // Check data availability depending on mode
  const hasSleep = !!(day?.sleep?.phases_5min && day?.sleep?.bedtime_start);
  const hasHeart = viewMode === 'sleep-effector'
    ? !!(day?.heart?.samples?.length || prevDay?.heart?.samples?.length)
    : !!(day?.heart?.samples?.length);
  const hasActivity = viewMode === 'sleep-effector'
    ? !!(
        (day?.workout?.met_items?.length && day?.workout?.met_timestamp) ||
        day?.workout?.class_5min ||
        (prevDay?.workout?.met_items?.length && prevDay?.workout?.met_timestamp) ||
        prevDay?.workout?.class_5min
      )
    : !!(day?.workout && (
        (day.workout.met_items?.length && day.workout.met_timestamp) ||
        day.workout.class_5min
      ));

  // Create plugin instance (stable ref)
  const eventMarkerPlugin = useMemo(() => createEventMarkerPlugin(markerHitboxes), []);

  const config = useMemo((): ChartConfiguration | null => {
    if (!day) return null;
    if (!showSleep && !showHeart && !showActivity) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const datasets: any[] = [];

    // --- Sleep hypnogram dataset ---
    if (showSleep && hasSleep) {
      const phases = parsePipeString(day.sleep!.phases_5min!);
      const points = mapToClockHours(phases, day.sleep!.bedtime_start!, 5);

      const shifted = points.map(p => {
        let x = p.hour;
        if (viewMode === 'sleep-effector') {
          if (x < 12) x += 24;
        } else {
          while (x < effectiveStart) x += 24;
          while (x >= effectiveStart + 24) x -= 24;
        }
        return { x, y: p.value };
      });

      datasets.push({
        label: 'Sleep Stage',
        data: shifted,
        borderColor: '#74b9ff',
        borderWidth: 2,
        pointRadius: 0,
        stepped: 'before' as const,
        fill: false,
        tension: 0,
        yAxisID: 'ySleep',
      });
    }

    // --- Heart rate dataset ---
    if (showHeart && hasHeart) {
      let points: { x: number; y: number }[];

      if (viewMode === 'sleep-effector') {
        const prev = (prevDay?.heart?.samples || []).map(s => {
          const dt = new Date(s.ts);
          return { x: dt.getHours() + dt.getMinutes() / 60, y: s.bpm };
        });
        const curr = (day?.heart?.samples || []).map(s => {
          const dt = new Date(s.ts);
          return { x: dt.getHours() + dt.getMinutes() / 60 + 24, y: s.bpm };
        });
        points = [...prev, ...curr]
          .filter(p => p.x >= 8 && p.x < 32)
          .sort((a, b) => a.x - b.x);
      } else {
        points = (day?.heart?.samples || []).map(s => {
          const dt = new Date(s.ts);
          let hour = dt.getHours() + dt.getMinutes() / 60;
          while (hour < effectiveStart) hour += 24;
          while (hour >= effectiveStart + 24) hour -= 24;
          return { x: hour, y: s.bpm };
        }).sort((a, b) => a.x - b.x);
      }

      if (points.length > 0) {
        datasets.push({
          label: 'Heart Rate',
          data: points,
          borderColor: '#ff6b6b',
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0.3,
          yAxisID: 'yHeart',
        });
      }
    }

    // --- Activity dataset ---
    if (showActivity && hasActivity) {
      let points: { x: number; y: number }[] = [];

      if (viewMode === 'sleep-effector') {
        const prevPts = getActivityPoints(prevDay, 0);
        const currPts = getActivityPoints(day, 24);
        points = [...prevPts, ...currPts]
          .filter(p => p.x >= 8 && p.x < 32)
          .sort((a, b) => a.x - b.x);
      } else {
        const w = day?.workout;
        if (w) {
          if (w.met_items && w.met_items.length > 0 && w.met_timestamp) {
            const mapped = mapToClockHours(w.met_items, w.met_timestamp, 5);
            points = mapped.map(p => {
              let x = p.hour;
              while (x < effectiveStart) x += 24;
              while (x >= effectiveStart + 24) x -= 24;
              return { x, y: p.value };
            });
          } else if (w.class_5min) {
            const phases = parsePipeString(w.class_5min);
            const startOfDay = day!.date + 'T00:00:00';
            const mapped = mapToClockHours(phases, startOfDay, 5);
            points = mapped.map(p => {
              let x = p.hour;
              while (x < effectiveStart) x += 24;
              while (x >= effectiveStart + 24) x -= 24;
              return { x, y: p.value };
            });
          }
          points.sort((a, b) => a.x - b.x);
        }
      }

      if (points.length > 0) {
        datasets.push({
          label: 'Activity',
          data: points,
          borderColor: '#55efc4',
          backgroundColor: 'rgba(85, 239, 196, 0.08)',
          borderWidth: 1.5,
          pointRadius: 0,
          fill: true,
          tension: 0.3,
          yAxisID: 'yActivity',
        });
      }
    }

    if (datasets.length === 0) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scales: any = {
      x: {
        type: 'linear',
        min: effectiveStart,
        max: effectiveStart + 24,
        ticks: {
          stepSize: 2,
          callback: (val: unknown) => formatHour(val as number),
          color: '#55556a',
          font: { size: 10 },
        },
        title: { display: true, text: 'Clock Time', color: '#55556a' },
        grid: { color: 'rgba(42, 42, 64, 0.5)' },
      },
    };

    if (showSleep && hasSleep) {
      scales.ySleep = {
        position: 'left',
        min: 1,
        max: 4,
        ticks: {
          stepSize: 1,
          autoSkip: false,
          callback: (val: unknown) => STAGE_LABELS[val as number] ?? '',
          color: '#74b9ff',
          font: { size: 11, weight: 'bold' as const },
          padding: 6,
        },
        afterFit: (axis: { width: number }) => { axis.width = 65; },
        grid: { drawOnChartArea: !showHeart && !showActivity, color: 'rgba(42, 42, 64, 0.3)' },
      };
    }

    if (showHeart && hasHeart) {
      scales.yHeart = {
        position: showSleep && hasSleep ? 'right' : 'left',
        ticks: {
          color: '#ff6b6b',
          font: { size: 10 },
        },
        title: { display: true, text: 'BPM', color: '#ff6b6b', font: { size: 10 } },
        grid: { drawOnChartArea: !showSleep && !showActivity, color: 'rgba(42, 42, 64, 0.3)' },
      };
    }

    if (showActivity && hasActivity) {
      scales.yActivity = {
        position: 'right',
        ticks: {
          color: '#55efc4',
          font: { size: 10 },
        },
        title: { display: true, text: 'MET', color: '#55efc4', font: { size: 10 } },
        grid: { drawOnChartArea: !showSleep && !showHeart, color: 'rgba(42, 42, 64, 0.3)' },
      };
    }

    return {
      type: 'line',
      data: { datasets },
      options: {
        layout: {
          padding: { top: 24 },
        },
        interaction: {
          mode: 'nearest',
          intersect: false,
        },
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
                if (label === 'Sleep Stage') return STAGE_LABELS[y] || `Stage ${y}`;
                if (label === 'Heart Rate') return `${y} BPM`;
                if (label === 'Activity') return `${y.toFixed(1)} MET`;
                return `${y}`;
              },
            },
          },
          // Pass events to the marker plugin via config
          eventMarkers: {
            events: allEvents,
            effectiveStart,
          },
        },
        scales,
      },
      plugins: [eventMarkerPlugin],
    };
  }, [day, prevDay, showSleep, showHeart, showActivity, effectiveStart, startHour, viewMode, hasSleep, hasHeart, hasActivity, allEvents, eventMarkerPlugin]);

  const canvasRef = useChart(config);

  // Click handler for event markers
  const handleCanvasClick = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || markerHitboxes.current.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    // Convert client coords to canvas CSS-pixel coords, accounting for
    // possible scaling between the canvas buffer and its CSS display size.
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    for (const hb of markerHitboxes.current) {
      if (cx >= hb.x && cx <= hb.x + hb.width && cy >= hb.top && cy <= hb.bottom) {
        setActivePopup({ event: hb.event, x: e.clientX, y: e.clientY });
        return;
      }
    }
    setActivePopup(null);
  }, [canvasRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('click', handleCanvasClick);
    return () => canvas.removeEventListener('click', handleCanvasClick);
  }, [canvasRef, handleCanvasClick, config]);

  // Save event handler
  const handleSaveEvent = useCallback(async (event: HealthEvent) => {
    if (!day) return;
    const existingEvents = day.events || [];
    const idx = existingEvents.findIndex(e => e.id === event.id);
    const updatedEvents = idx >= 0
      ? existingEvents.map((e, i) => i === idx ? event : e)
      : [...existingEvents, event];

    const updatedDay: DayRecord = { ...day, events: updatedEvents };
    const result = store.saveDay(updatedDay);
    if (result instanceof Promise) await result;
    setShowForm(false);
    setDreamMode(false);
    setEditingEvent(null);
    setActivePopup(null);
    onDayUpdated?.();
  }, [day, store, onDayUpdated]);

  // Delete event handler
  const handleDeleteEvent = useCallback(async (id: string) => {
    if (!day) return;
    const updatedEvents = (day.events || []).filter(e => e.id !== id);
    const updatedDay: DayRecord = { ...day, events: updatedEvents };
    const result = store.saveDay(updatedDay);
    if (result instanceof Promise) await result;
    setActivePopup(null);
    onDayUpdated?.();
  }, [day, store, onDayUpdated]);

  if (!day) {
    return (
      <div className="day-intraday">
        <div className="overlay-chart-card">
          <p className="overlay-fallback">Select a day to see intraday data</p>
        </div>
      </div>
    );
  }

  const hasAnyData = hasSleep || hasHeart || hasActivity;

  return (
    <div className="day-intraday">
      <div className="overlay-chart-card" ref={cardRef} style={{ position: 'relative' }}>
        <div className="intraday-header">
          <h3>24-Hour View{day?.date ? ` — ${new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}` : ''}</h3>
          <select
            className="intraday-view-select"
            value={viewMode}
            onChange={e => setViewMode(e.target.value as ViewMode)}
          >
            <option value="full">Full Day</option>
            <option value="sleep-effector">Sleep Effector</option>
          </select>
          <div className="intraday-toggles">
            <button
              className={`intraday-toggle ${showSleep ? 'active' : ''}`}
              style={{ '--toggle-color': '#74b9ff' } as React.CSSProperties}
              onClick={() => setShowSleep(v => !v)}
            >
              Sleep
            </button>
            <button
              className={`intraday-toggle ${showHeart ? 'active' : ''}`}
              style={{ '--toggle-color': '#ff6b6b' } as React.CSSProperties}
              onClick={() => setShowHeart(v => !v)}
            >
              Heart
            </button>
            <button
              className={`intraday-toggle ${showActivity ? 'active' : ''}`}
              style={{ '--toggle-color': '#55efc4' } as React.CSSProperties}
              onClick={() => setShowActivity(v => !v)}
            >
              Activity
            </button>
            {!readOnly && (
              <>
                <button
                  className="intraday-add-btn"
                  onClick={() => { setShowForm(true); setDreamMode(false); setEditingEvent(null); }}
                  title="Add event marker"
                >
                  +
                </button>
                <button
                  className="intraday-dream-btn"
                  onClick={() => { setShowForm(true); setDreamMode(true); setEditingEvent(null); }}
                  title="Record a dream"
                >
                  🌙
                </button>
              </>
            )}
          </div>
          {viewMode === 'full' && (
            <label className="hypnogram-start-label">
              Start
              <input
                type="number"
                className="hypnogram-start-input"
                min={0}
                max={23}
                value={startHour}
                onChange={e => setStartHour(Math.min(23, Math.max(0, Number(e.target.value))))}
              />
              :00
            </label>
          )}
        </div>

        {showForm && (
          <EventForm
            initial={editingEvent}
            dreamMode={dreamMode && !editingEvent}
            onSave={handleSaveEvent}
            onCancel={() => { setShowForm(false); setDreamMode(false); setEditingEvent(null); }}
          />
        )}

        {day.source === 'sample' && (
          <div className="sample-data-notice">
            Placeholder data — connect Oura or import data for real results
          </div>
        )}

        {hasAnyData && config ? (
          <canvas ref={canvasRef} />
        ) : (
          <p className="overlay-fallback">No intraday data for this day</p>
        )}

        {activePopup && cardRef.current && (
          <EventPopup
            event={activePopup.event}
            x={activePopup.x}
            y={activePopup.y}
            containerRect={cardRef.current.getBoundingClientRect()}
            onEdit={readOnly ? () => setActivePopup(null) : () => {
              setEditingEvent(activePopup.event);
              setShowForm(true);
              setActivePopup(null);
            }}
            onDelete={readOnly ? () => setActivePopup(null) : () => handleDeleteEvent(activePopup.event.id)}
            onClose={() => setActivePopup(null)}
            readOnly={readOnly}
          />
        )}
      </div>
    </div>
  );
}

/** Extract activity points from a day record, adding hourOffset to each hour value. */
function getActivityPoints(d: DayRecord | null | undefined, hourOffset: number): { x: number; y: number }[] {
  if (!d?.workout) return [];
  const w = d.workout;
  if (w.met_items && w.met_items.length > 0 && w.met_timestamp) {
    const mapped = mapToClockHours(w.met_items, w.met_timestamp, 5);
    return mapped.map(p => ({ x: p.hour + hourOffset, y: p.value }));
  }
  if (w.class_5min) {
    const phases = parsePipeString(w.class_5min);
    const startOfDay = d.date + 'T00:00:00';
    const mapped = mapToClockHours(phases, startOfDay, 5);
    return mapped.map(p => ({ x: p.hour + hourOffset, y: p.value }));
  }
  return [];
}
