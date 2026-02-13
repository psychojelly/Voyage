import type { DayRecord } from './types';

export function normalizeOuraSleep(apiData: { data?: Array<Record<string, unknown>> }): DayRecord[] {
  if (!apiData || !apiData.data) return [];
  return apiData.data.map(item => {
    // Detect format: detailed /sleep has total_sleep_duration, daily_sleep has contributors
    const isDetailed = item.total_sleep_duration != null;
    const contributors = item.contributors as Record<string, number> | undefined;

    const record: DayRecord = {
      date: item.day as string,
      source: 'oura',
      sleep: isDetailed ? {
        duration_hours: round(((item.total_sleep_duration as number) || 0) / 3600, 1),
        efficiency: (item.efficiency as number) || 0,
        deep_min: Math.round(((item.deep_sleep_duration as number) || 0) / 60),
        rem_min: Math.round(((item.rem_sleep_duration as number) || 0) / 60),
        light_min: Math.round(((item.light_sleep_duration as number) || 0) / 60),
        awake_min: Math.round(((item.awake_time as number) || 0) / 60),
        readiness_score: ((item.readiness as { score?: number })?.score || (item.score as number)) || 0,
        phases_5min: (item.sleep_phase_5_min as string) || undefined,
        bedtime_start: (item.bedtime_start as string) || undefined,
        bedtime_end: (item.bedtime_end as string) || undefined,
      } : {
        // daily_sleep format: scores only (0-100), no raw durations
        duration_hours: 0,
        efficiency: contributors?.efficiency || 0,
        deep_min: 0,
        rem_min: 0,
        light_min: 0,
        awake_min: 0,
        readiness_score: (item.score as number) || 0,
      },
    };

    // Detailed sleep periods include heart rate & HRV aggregates.
    // Only set fields sleep data can accurately provide — hr_max
    // comes from the heartrate endpoint, not sleep.
    if (isDetailed) {
      const lowestHr = item.lowest_heart_rate as number | undefined;
      const avgHrv = item.average_hrv as number | undefined;
      if (lowestHr || avgHrv) {
        record.heart = {
          resting_hr: lowestHr || 0,
          hrv_avg: avgHrv || 0,
          hr_min: lowestHr || 0,
          hr_max: 0,
        };
      }
    }

    return record;
  });
}

export function normalizeOuraHeartRate(apiData: { data?: Array<Record<string, unknown>> }): DayRecord[] {
  if (!apiData || !apiData.data) return [];
  const byDay: Record<string, { bpms: number[]; hrv: number[]; samples: { ts: string; bpm: number }[] }> = {};
  for (const item of apiData.data) {
    const day = (item.day as string) || ((item.timestamp as string) ? (item.timestamp as string).slice(0, 10) : null);
    if (!day) continue;
    if (!byDay[day]) byDay[day] = { bpms: [], hrv: [], samples: [] };
    if (item.bpm != null) {
      byDay[day].bpms.push(item.bpm as number);
      if (item.timestamp) {
        byDay[day].samples.push({ ts: item.timestamp as string, bpm: item.bpm as number });
      }
    }
    if (item.hrv != null) byDay[day].hrv.push(item.hrv as number);
  }
  return Object.entries(byDay).map(([date, vals]) => ({
    date,
    source: 'oura',
    heart: {
      resting_hr: vals.bpms.length ? Math.round(Math.min(...vals.bpms)) : 0,
      hrv_avg: vals.hrv.length ? Math.round(avg(vals.hrv)) : 0,
      hr_min: vals.bpms.length ? Math.min(...vals.bpms) : 0,
      hr_max: vals.bpms.length ? Math.max(...vals.bpms) : 0,
      samples: vals.samples.length ? downsampleTimeSeries(vals.samples, 300) : undefined,
    },
  }));
}

export function normalizeOuraActivity(apiData: { data?: Array<Record<string, unknown>> }): DayRecord[] {
  if (!apiData || !apiData.data) return [];
  return apiData.data.map(item => ({
    date: item.day as string,
    source: 'oura',
    workout: {
      activity_score: (item.score as number) || 0,
      calories_active: (item.active_calories as number) || 0,
      steps: (item.steps as number) || 0,
      active_min: Math.round(((item.high_activity_time as number) || 0 + ((item.medium_activity_time as number) || 0)) / 60),
      class_5min: (item.class_5_min as string) || undefined,
      met_items: downsampleMet(item.met),
      met_timestamp: (item.met as { timestamp?: string })?.timestamp || undefined,
    },
  }));
}

export function normalizeOuraStress(apiData: { data?: Array<Record<string, unknown>> }): DayRecord[] {
  if (!apiData || !apiData.data) return [];
  return apiData.data.map(item => ({
    date: item.day as string,
    source: 'oura',
    stress: {
      // Oura API returns seconds — convert to minutes
      stress_high: Math.round(((item.stress_high as number) || 0) / 60),
      recovery_high: Math.round(((item.recovery_high as number) || 0) / 60),
      day_summary: (item.day_summary as string) || 'normal',
    },
  }));
}

export function normalizeCsv(rows: Record<string, string>[]): DayRecord[] {
  if (!rows || !rows.length) return [];
  return rows.map(row => {
    const day: DayRecord = {
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
    if (row.stress_high || row.recovery_high || row.day_summary) {
      day.stress = {
        stress_high: parseNum(row.stress_high),
        recovery_high: parseNum(row.recovery_high),
        day_summary: row.day_summary || 'normal',
      };
    }
    return day;
  }).filter(d => d.date);
}

export function normalizeJson(data: unknown): DayRecord[] {
  if (Array.isArray(data)) {
    if (data[0] && data[0].date && (data[0].sleep || data[0].heart || data[0].workout || data[0].stress)) {
      return data;
    }
  }
  const obj = data as { data?: unknown[] };
  if (obj && obj.data && Array.isArray(obj.data)) {
    const first = obj.data[0] as Record<string, unknown> | undefined;
    if (first) {
      if (first.total_sleep_duration != null || (first.contributors != null && first.score != null)) return normalizeOuraSleep(obj as { data: Array<Record<string, unknown>> });
      if (first.bpm != null) return normalizeOuraHeartRate(obj as { data: Array<Record<string, unknown>> });
      if (first.steps != null || first.active_calories != null) return normalizeOuraActivity(obj as { data: Array<Record<string, unknown>> });
      if (first.stress_high != null || first.day_summary != null) return normalizeOuraStress(obj as { data: Array<Record<string, unknown>> });
    }
  }
  return [];
}

export function parseCsvString(csvText: string): Record<string, string>[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  });
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
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

function downsampleMet(met: unknown): number[] | undefined {
  const obj = met as { interval?: number; items?: number[]; timestamp?: string } | null;
  if (!obj || !obj.items || !obj.items.length) return undefined;
  const interval = obj.interval || 60;
  if (interval >= 300) return obj.items; // already 5-min or coarser
  const bucketSize = Math.round(300 / interval); // samples per 5-min bucket
  const result: number[] = [];
  for (let i = 0; i < obj.items.length; i += bucketSize) {
    const slice = obj.items.slice(i, i + bucketSize);
    result.push(slice.reduce((s, v) => s + v, 0) / slice.length);
  }
  return result;
}

/** Downsample timestamped BPM readings into buckets of `intervalSec` seconds.
 *  Keeps one averaged reading per bucket to reduce payload size. */
function downsampleTimeSeries(
  samples: { ts: string; bpm: number }[],
  intervalSec: number,
): { ts: string; bpm: number }[] {
  if (samples.length === 0) return samples;
  const sorted = [...samples].sort((a, b) => a.ts.localeCompare(b.ts));
  const result: { ts: string; bpm: number }[] = [];
  let bucketStart = new Date(sorted[0].ts).getTime();
  let bucketBpms: number[] = [];
  let bucketTs = sorted[0].ts;

  for (const s of sorted) {
    const t = new Date(s.ts).getTime();
    if (t - bucketStart >= intervalSec * 1000) {
      // Flush current bucket
      if (bucketBpms.length) {
        result.push({ ts: bucketTs, bpm: Math.round(bucketBpms.reduce((a, b) => a + b, 0) / bucketBpms.length) });
      }
      bucketStart = t;
      bucketBpms = [];
      bucketTs = s.ts;
    }
    bucketBpms.push(s.bpm);
  }
  // Flush last bucket
  if (bucketBpms.length) {
    result.push({ ts: bucketTs, bpm: Math.round(bucketBpms.reduce((a, b) => a + b, 0) / bucketBpms.length) });
  }
  return result;
}

function parseNum(val: string | undefined | null): number {
  if (val == null || val === '') return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function avg(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
