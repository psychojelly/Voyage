import type { DayRecord, Settings } from './types';

const KEY_PREFIX = 'health_';
const SETTINGS_KEY = 'health_settings';

function isBrowser() {
  return typeof window !== 'undefined';
}

export function saveDay(day: DayRecord) {
  if (!isBrowser() || !day || !day.date) return;
  const key = KEY_PREFIX + day.date;
  const existing = loadDay(day.date);
  const merged = existing ? mergeDay(existing, day) : day;
  localStorage.setItem(key, JSON.stringify(merged));
}

export function saveDays(days: DayRecord[]) {
  for (const day of days) {
    saveDay(day);
  }
}

/** Save sample days, skipping dates that already have real (non-sample) data. */
export function saveSampleDays(days: DayRecord[]) {
  for (const day of days) {
    const existing = loadDay(day.date);
    if (existing && existing.source && existing.source !== 'sample') continue;
    saveDay(day);
  }
}

export function loadDay(date: string): DayRecord | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(KEY_PREFIX + date);
  return raw ? JSON.parse(raw) : null;
}

export function loadRange(startDate: string, endDate: string): DayRecord[] {
  if (!isBrowser()) return [];
  const days: DayRecord[] = [];
  // Parse as local time (not UTC) by appending T00:00:00
  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  while (current <= end) {
    const dateStr = formatDate(current);
    const day = loadDay(dateStr);
    if (day) days.push(day);
    current.setDate(current.getDate() + 1);
  }
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

export function getMonthData(year: number, month: number): DayRecord[] {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return loadRange(start, end);
}

export function getAllDates(): string[] {
  if (!isBrowser()) return [];
  const dates: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(KEY_PREFIX) && key !== SETTINGS_KEY) {
      dates.push(key.slice(KEY_PREFIX.length));
    }
  }
  return dates.sort();
}

export function clearAllData() {
  if (!isBrowser()) return;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(KEY_PREFIX) && key !== SETTINGS_KEY) {
      keys.push(key);
    }
  }
  keys.forEach(k => localStorage.removeItem(k));
}

export function clearSampleData() {
  if (!isBrowser()) return;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(KEY_PREFIX) && key !== SETTINGS_KEY) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const record = JSON.parse(raw);
          if (record.source === 'sample') keys.push(key);
        } catch { /* skip */ }
      }
    }
  }
  keys.forEach(k => localStorage.removeItem(k));
}

export function saveSettings(settings: Partial<Settings>) {
  if (!isBrowser()) return;
  const existing = loadSettings();
  const merged = { ...existing, ...settings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
}

export function loadSettings(): Settings {
  if (!isBrowser()) return {};
  const raw = localStorage.getItem(SETTINGS_KEY);
  return raw ? JSON.parse(raw) : {};
}

function mergeDay(existing: DayRecord, incoming: DayRecord): DayRecord {
  return {
    date: existing.date,
    source: incoming.source || existing.source,
    sleep: mergeSubData(existing.sleep, incoming.sleep) as DayRecord['sleep'],
    heart: mergeSubData(existing.heart, incoming.heart) as DayRecord['heart'],
    workout: mergeSubData(existing.workout, incoming.workout) as DayRecord['workout'],
    stress: mergeSubData(existing.stress, incoming.stress) as DayRecord['stress'],
    events: incoming.events || existing.events,
  };
}

/** Merge sub-objects without overwriting existing truthy values with falsy/zero ones.
 *  e.g. sleep sets hr_max:0 but heart rate sets hr_max:150 — keep 150. */
function mergeSubData<T extends object>(existing: T | undefined, incoming: T | undefined): T | undefined {
  if (!existing) return incoming;
  if (!incoming) return existing;
  const result = { ...existing } as Record<string, unknown>;
  for (const [key, val] of Object.entries(incoming)) {
    if (val || val === false || !result[key]) {
      result[key] = val;
    }
  }
  return result as T;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
