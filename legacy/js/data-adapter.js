export function normalizeOuraSleep(apiData) {
  if (!apiData || !apiData.data) return [];
  return apiData.data.map(item => ({
    date: item.day,
    source: 'oura',
    sleep: {
      duration_hours: round((item.total_sleep_duration || 0) / 3600, 1),
      efficiency: item.efficiency || 0,
      deep_min: Math.round((item.deep_sleep_duration || 0) / 60),
      rem_min: Math.round((item.rem_sleep_duration || 0) / 60),
      light_min: Math.round((item.light_sleep_duration || 0) / 60),
      awake_min: Math.round((item.awake_time || 0) / 60),
      readiness_score: item.readiness?.score || item.score || 0,
    },
  }));
}

export function normalizeOuraHeartRate(apiData) {
  if (!apiData || !apiData.data) return [];
  const byDay = {};
  for (const item of apiData.data) {
    const day = item.day || (item.timestamp ? item.timestamp.slice(0, 10) : null);
    if (!day) continue;
    if (!byDay[day]) byDay[day] = { bpms: [], hrv: [] };
    if (item.bpm != null) byDay[day].bpms.push(item.bpm);
    if (item.hrv != null) byDay[day].hrv.push(item.hrv);
  }
  return Object.entries(byDay).map(([date, vals]) => ({
    date,
    source: 'oura',
    heart: {
      resting_hr: vals.bpms.length ? Math.round(Math.min(...vals.bpms)) : 0,
      hrv_avg: vals.hrv.length ? Math.round(avg(vals.hrv)) : 0,
      hr_min: vals.bpms.length ? Math.min(...vals.bpms) : 0,
      hr_max: vals.bpms.length ? Math.max(...vals.bpms) : 0,
    },
  }));
}

export function normalizeOuraActivity(apiData) {
  if (!apiData || !apiData.data) return [];
  return apiData.data.map(item => ({
    date: item.day,
    source: 'oura',
    workout: {
      activity_score: item.score || 0,
      calories_active: item.active_calories || 0,
      steps: item.steps || 0,
      active_min: Math.round((item.high_activity_time || 0 + (item.medium_activity_time || 0)) / 60),
    },
  }));
}

export function normalizeCsv(rows) {
  if (!rows || !rows.length) return [];
  return rows.map(row => {
    const day = {
      date: row.date || row.Date || row.day || row.Day || '',
      source: 'csv',
    };
    if (row.duration_hours || row.sleep_duration || row.efficiency) {
      day.sleep = {
        duration_hours: parseNum(row.duration_hours || row.sleep_duration),
        efficiency: parseNum(row.efficiency || row.sleep_efficiency),
        deep_min: parseNum(row.deep_min || row.deep_sleep),
        rem_min: parseNum(row.rem_min || row.rem_sleep),
        light_min: parseNum(row.light_min || row.light_sleep),
        awake_min: parseNum(row.awake_min || row.awake_time),
        readiness_score: parseNum(row.readiness_score || row.readiness),
      };
    }
    if (row.resting_hr || row.hrv_avg || row.heart_rate) {
      day.heart = {
        resting_hr: parseNum(row.resting_hr || row.heart_rate),
        hrv_avg: parseNum(row.hrv_avg || row.hrv),
        hr_min: parseNum(row.hr_min),
        hr_max: parseNum(row.hr_max),
      };
    }
    if (row.steps || row.calories_active || row.activity_score) {
      day.workout = {
        activity_score: parseNum(row.activity_score),
        calories_active: parseNum(row.calories_active || row.calories),
        steps: parseNum(row.steps),
        active_min: parseNum(row.active_min || row.active_minutes),
      };
    }
    return day;
  }).filter(d => d.date);
}

export function normalizeJson(data) {
  if (Array.isArray(data)) {
    // Check if it looks like our internal format
    if (data[0] && data[0].date && (data[0].sleep || data[0].heart || data[0].workout)) {
      return data;
    }
  }
  // Check if it's an Oura API response
  if (data && data.data && Array.isArray(data.data)) {
    const first = data.data[0];
    if (first) {
      if (first.total_sleep_duration != null) return normalizeOuraSleep(data);
      if (first.bpm != null) return normalizeOuraHeartRate(data);
      if (first.steps != null || first.active_calories != null) return normalizeOuraActivity(data);
    }
  }
  return [];
}

export function parseCsvString(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  });
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

function parseNum(val) {
  if (val == null || val === '') return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function avg(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function round(n, decimals) {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
