'use client';

import { useState, useCallback } from 'react';

interface CalendarDayPickerProps {
  year: number;
  month: number;
  selectedDays: Set<number>;
  onChange: (days: Set<number>) => void;
}

export default function CalendarDayPicker({ year, month, selectedDays, onChange }: CalendarDayPickerProps) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const allDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const allSelected = selectedDays.size === daysInMonth;

  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');

  const toggleDay = useCallback((day: number) => {
    const next = new Set(selectedDays);
    if (next.has(day)) {
      next.delete(day);
    } else {
      next.add(day);
    }
    onChange(next);
  }, [selectedDays, onChange]);

  const toggleAll = useCallback(() => {
    if (allSelected) {
      onChange(new Set());
    } else {
      onChange(new Set(allDays));
    }
  }, [allSelected, allDays, onChange]);

  const applyRange = useCallback(() => {
    const from = parseInt(rangeFrom, 10);
    const to = parseInt(rangeTo, 10);
    if (isNaN(from) || isNaN(to) || from < 1 || to > daysInMonth || from > to) return;
    const next = new Set<number>();
    for (let i = from; i <= to; i++) next.add(i);
    onChange(next);
  }, [rangeFrom, rangeTo, daysInMonth, onChange]);

  return (
    <div className="day-picker">
      <div className="day-picker-header">
        <span className="day-picker-title">Filter Days</span>
        <button className="day-picker-toggle" onClick={toggleAll}>
          {allSelected ? 'Clear All' : 'Select All'}
        </button>
      </div>
      <div className="day-picker-grid">
        {allDays.map(day => (
          <button
            key={day}
            className={`day-picker-btn${selectedDays.has(day) ? ' active' : ''}`}
            onClick={() => toggleDay(day)}
          >
            {day}
          </button>
        ))}
      </div>
      <div className="day-picker-range">
        <input
          type="number"
          min={1}
          max={daysInMonth}
          placeholder="From"
          value={rangeFrom}
          onChange={(e) => setRangeFrom(e.target.value)}
        />
        <span>&ndash;</span>
        <input
          type="number"
          min={1}
          max={daysInMonth}
          placeholder="To"
          value={rangeTo}
          onChange={(e) => setRangeTo(e.target.value)}
        />
        <button className="btn btn-secondary day-picker-apply" onClick={applyRange}>Apply</button>
      </div>
    </div>
  );
}
