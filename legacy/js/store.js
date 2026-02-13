const KEY_PREFIX = 'health_';
const SETTINGS_KEY = 'health_settings';

export function saveDay(day) {
  if (!day || !day.date) return;
  const key = KEY_PREFIX + day.date;
  const existing = loadDay(day.date);
  const merged = existing ? mergeDay(existing, day) : day;
  localStorage.setItem(key, JSON.stringify(merged));
}

export function saveDays(days) {
  for (const day of days) {
    saveDay(day);
  }
}

export function loadDay(date) {
  const raw = localStorage.getItem(KEY_PREFIX + date);
  return raw ? JSON.parse(raw) : null;
}

export function loadRange(startDate, endDate) {
  const days = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    const dateStr = formatDate(current);
    const day = loadDay(dateStr);
    if (day) days.push(day);
    current.setDate(current.getDate() + 1);
  }
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

export function getMonthData(year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return loadRange(start, end);
}

export function getAllDates() {
  const dates = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(KEY_PREFIX) && key !== SETTINGS_KEY) {
      dates.push(key.slice(KEY_PREFIX.length));
    }
  }
  return dates.sort();
}

export function clearAllData() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(KEY_PREFIX) && key !== SETTINGS_KEY) {
      keys.push(key);
    }
  }
  keys.forEach(k => localStorage.removeItem(k));
}

export function saveSettings(settings) {
  const existing = loadSettings();
  const merged = { ...existing, ...settings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
}

export function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  return raw ? JSON.parse(raw) : {};
}

function mergeDay(existing, incoming) {
  return {
    date: existing.date,
    source: incoming.source || existing.source,
    sleep: { ...(existing.sleep || {}), ...(incoming.sleep || {}) },
    heart: { ...(existing.heart || {}), ...(incoming.heart || {}) },
    workout: { ...(existing.workout || {}), ...(incoming.workout || {}) },
  };
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
