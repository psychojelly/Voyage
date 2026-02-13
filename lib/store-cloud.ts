import type { DayRecord, Settings } from './types';

// Cloud store: async functions that call /api/health/* routes

export async function cloudSaveDay(day: DayRecord): Promise<void> {
  await fetch('/api/health/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(day),
  });
}

export async function cloudSaveDays(days: DayRecord[]): Promise<void> {
  // Batch into chunks of 5 days to stay under Vercel's body size limit
  const BATCH_SIZE = 5;
  for (let i = 0; i < days.length; i += BATCH_SIZE) {
    const batch = days.slice(i, i + BATCH_SIZE);
    await fetch('/api/health/records', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: batch }),
    });
  }
}

export async function cloudGetMonthData(year: number, month: number): Promise<DayRecord[]> {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const res = await fetch(`/api/health/records?start=${start}&end=${end}`);
  if (!res.ok) return [];
  return res.json();
}

export async function cloudGetDateRange(start: string, end: string): Promise<DayRecord[]> {
  const res = await fetch(`/api/health/records?start=${start}&end=${end}`);
  if (!res.ok) return [];
  return res.json();
}

export async function cloudGetAllDates(): Promise<string[]> {
  const res = await fetch('/api/health/records?dates_only=true');
  if (!res.ok) return [];
  return res.json();
}

export async function cloudClearAllData(): Promise<void> {
  await fetch('/api/health/records', { method: 'DELETE' });
}

export async function cloudLoadSettings(): Promise<Settings> {
  const res = await fetch('/api/health/settings');
  if (!res.ok) return {};
  return res.json();
}

export async function cloudSaveSettings(patch: Partial<Settings>): Promise<void> {
  await fetch('/api/health/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

/** Fetch another user's data by date range (for admin/artist viewing) */
export async function fetchUserDateRange(userId: string, start: string, end: string): Promise<DayRecord[]> {
  const res = await fetch(`/api/health/records?userId=${userId}&start=${start}&end=${end}`);
  if (!res.ok) return [];
  return res.json();
}

export async function cloudSyncFromLocal(records: DayRecord[]): Promise<{ synced: number }> {
  const res = await fetch('/api/health/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records }),
  });
  if (!res.ok) throw new Error('Sync failed');
  return res.json();
}
