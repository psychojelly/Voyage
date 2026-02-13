'use client';

import { useState, useCallback } from 'react';
import type { HealthEvent } from '@/lib/types';

interface CalendarInfo {
  id: string;
  summary: string;
  backgroundColor?: string;
}

export function useGoogleCalendar() {
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<{ text: string; type: '' | 'success' | 'error' | 'loading' }>({ text: '', type: '' });
  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Check if user signed in with Google (has calendar access) by trying the calendars endpoint
  const checkConnection = useCallback(async () => {
    try {
      const res = await fetch('/api/gcal/calendars');
      if (res.ok) {
        const data = await res.json();
        setIsConnected(true);
        setCalendars(data.calendars || []);
        setSelectedIds(data.selectedIds || []);
      } else {
        setIsConnected(false);
      }
    } catch {
      setIsConnected(false);
    }
  }, []);

  const loadCalendars = useCallback(async () => {
    try {
      const res = await fetch('/api/gcal/calendars');
      if (!res.ok) return;
      const data = await res.json();
      setCalendars(data.calendars || []);
      setSelectedIds(data.selectedIds || []);
    } catch { /* ignore */ }
  }, []);

  const saveSelection = useCallback(async (ids: string[]) => {
    try {
      const res = await fetch('/api/gcal/calendars', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarIds: ids }),
      });
      if (res.ok) {
        setSelectedIds(ids);
        setStatus({ text: 'Calendar selection saved.', type: 'success' });
      }
    } catch {
      setStatus({ text: 'Failed to save selection.', type: 'error' });
    }
  }, []);

  const fetchEvents = useCallback(async (date: string): Promise<HealthEvent[]> => {
    try {
      const res = await fetch(`/api/gcal/events?date=${date}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.events || [];
    } catch {
      return [];
    }
  }, []);

  return {
    isConnected,
    status,
    setStatus,
    calendars,
    selectedIds,
    setSelectedIds,
    checkConnection,
    loadCalendars,
    saveSelection,
    fetchEvents,
  };
}
