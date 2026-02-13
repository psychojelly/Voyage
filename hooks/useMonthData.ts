'use client';

import { useState, useCallback } from 'react';
import { useStore } from '@/lib/store-provider';
import type { DayRecord } from '@/lib/types';

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatLabel(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const s = start.toLocaleDateString('en-US', opts);
  const e = end.toLocaleDateString('en-US', { ...opts, year: 'numeric' });
  return `${s} – ${e}`;
}

export function useMonthData(initialYear?: number, initialMonth?: number) {
  const store = useStore();
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const initDate = initialYear && initialMonth
    ? new Date(initialYear, initialMonth - 1, now.getDate())
    : yesterday;

  const [focusDate, setFocusDate] = useState(initDate);
  const [data, setData] = useState<DayRecord[]>([]);

  // Derived year/month/day from focusDate for backward compat
  const year = focusDate.getFullYear();
  const month = focusDate.getMonth() + 1;
  const day = focusDate.getDate();

  // Compute 30-day lookback range
  const endDate = new Date(focusDate);
  const startDate = new Date(focusDate);
  startDate.setDate(startDate.getDate() - 29);

  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);
  const label = formatLabel(startDate, endDate);

  const refresh = useCallback(async () => {
    const result = store.getDateRange(startStr, endStr);
    const resolved = result instanceof Promise ? await result : result;
    setData(resolved);
  }, [startStr, endStr, store]);

  const setYear = useCallback((y: number) => {
    setFocusDate(prev => {
      const d = new Date(prev);
      d.setFullYear(y);
      return d;
    });
  }, []);

  const setMonth = useCallback((m: number) => {
    setFocusDate(prev => {
      const d = new Date(prev);
      d.setMonth(m - 1);
      return d;
    });
  }, []);

  const setDay = useCallback((day: number) => {
    setFocusDate(prev => {
      const d = new Date(prev);
      d.setDate(day);
      return d;
    });
  }, []);

  const setFullDate = useCallback((y: number, m: number, d: number) => {
    setFocusDate(new Date(y, m - 1, d));
  }, []);

  const prevMonth = useCallback(() => {
    setFocusDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 30);
      return d;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setFocusDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 30);
      return d;
    });
  }, []);

  return {
    year, month, day, data, label, refresh,
    prevMonth, nextMonth,
    setYear, setMonth, setDay, setFullDate,
    focusDate, startStr, endStr,
  };
}
