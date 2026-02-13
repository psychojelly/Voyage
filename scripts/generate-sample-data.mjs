/**
 * Generates sample-data.json with intraday fields for the 24-Hour View.
 * Run: node scripts/generate-sample-data.mjs
 */
import { writeFileSync } from 'fs';

// Seeded pseudo-random for reproducibility
let seed = 42;
function rand() {
  seed = (seed * 16807 + 0) % 2147483647;
  return (seed - 1) / 2147483646;
}
function randInt(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function randFloat(min, max, decimals = 1) {
  return parseFloat((rand() * (max - min) + min).toFixed(decimals));
}

function generateDay(date) {
  // --- Summary stats (varied by day) ---
  const durationHours = randFloat(6.3, 8.5);
  const efficiency = randInt(78, 94);
  const deepMin = randInt(60, 105);
  const remMin = randInt(75, 120);
  const lightMin = randInt(180, 230);
  const awakeMin = randInt(15, 48);
  const readinessScore = randInt(62, 94);
  const restingHr = randInt(54, 66);
  const hrvAvg = randInt(30, 52);
  const hrMin = randInt(46, 60);
  const hrMax = randInt(130, 160);
  const activityScore = randInt(50, 92);
  const caloriesActive = randInt(250, 600);
  const steps = randInt(4500, 12500);
  const activeMin = randInt(30, 90);

  // --- Sleep intraday ---
  // bedtime_start: 22:00-23:30 the night before
  const bedHour = randInt(22, 23);
  const bedMin = randInt(0, 5) * 10; // 0,10,20,30,40,50
  const bedtime_start = `${date}T${String(bedHour).padStart(2, '0')}:${String(bedMin).padStart(2, '0')}:00`;

  // Total sleep slots (~7-8.5h in 5-min increments)
  const totalSlots = Math.round((durationHours * 60) / 5);

  // Generate realistic sleep cycle: ~90min cycles, each with Light->Deep->Light->REM
  const phases = [];
  let slot = 0;
  let cycleNum = 0;
  while (slot < totalSlots) {
    cycleNum++;
    // Each cycle: ~18 slots (90 min)
    // Deep decreases over cycles, REM increases
    const deepSlots = Math.max(2, Math.round((6 - cycleNum) * 1.5) + randInt(-1, 1));
    const remSlots = Math.min(10, Math.round(cycleNum * 2.5) + randInt(-1, 1));
    const lightSlots = Math.max(3, 18 - deepSlots - remSlots - randInt(0, 2));
    const awakeSlots = rand() < 0.25 ? randInt(1, 3) : 0; // occasional awake

    // Light -> Deep -> Light -> REM -> (Awake?)
    const halfLight = Math.floor(lightSlots / 2);
    const cycle = [
      ...Array(halfLight).fill(2),
      ...Array(deepSlots).fill(1),
      ...Array(lightSlots - halfLight).fill(2),
      ...Array(remSlots).fill(3),
      ...Array(awakeSlots).fill(4),
    ];

    for (const stage of cycle) {
      if (slot >= totalSlots) break;
      phases.push(stage);
      slot++;
    }
  }

  const phases_5min = phases.join('|');

  // bedtime_end calculated from start + duration
  const endMs = new Date(bedtime_start).getTime() + durationHours * 3600 * 1000;
  const endDate = new Date(endMs);
  // bedtime_end should be the next day morning
  const nextDay = new Date(date + 'T00:00:00');
  nextDay.setDate(nextDay.getDate() + 1);
  const bedtime_end_str = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}T${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}:00`;

  // --- Heart rate samples (every 5 min across 24h = 288 entries) ---
  const samples = [];
  for (let i = 0; i < 288; i++) {
    const hour = (i * 5) / 60;
    const minuteOfDay = i * 5;
    const h = Math.floor(minuteOfDay / 60);
    const m = minuteOfDay % 60;
    const ts = `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;

    let baseBpm;
    // Simulate diurnal HR pattern
    if (hour >= 0 && hour < 6) {
      // Sleeping: low HR
      baseBpm = restingHr - randInt(2, 8);
    } else if (hour >= 6 && hour < 8) {
      // Waking up
      baseBpm = restingHr + randInt(5, 15);
    } else if (hour >= 8 && hour < 12) {
      // Morning activity
      baseBpm = restingHr + randInt(10, 35);
    } else if (hour >= 12 && hour < 14) {
      // Lunch / midday
      baseBpm = restingHr + randInt(5, 20);
    } else if (hour >= 14 && hour < 18) {
      // Afternoon
      baseBpm = restingHr + randInt(10, 40);
      // Possible workout spike
      if (hour >= 16 && hour < 17.5 && rand() < 0.4) {
        baseBpm = randInt(hrMax - 30, hrMax);
      }
    } else if (hour >= 18 && hour < 22) {
      // Evening wind-down
      baseBpm = restingHr + randInt(5, 20);
    } else {
      // Late night / sleeping
      baseBpm = restingHr - randInt(0, 5);
    }

    // Add some noise
    baseBpm += randInt(-3, 3);
    baseBpm = Math.max(hrMin, Math.min(hrMax, baseBpm));

    samples.push({ ts, bpm: baseBpm });
  }

  // --- Activity / MET data (288 5-min intervals) ---
  const met_items = [];
  const met_timestamp = `${date}T00:00:00`;

  for (let i = 0; i < 288; i++) {
    const hour = (i * 5) / 60;
    let met;

    if (hour >= 0 && hour < 6) {
      met = randFloat(0.8, 1.0); // sleeping
    } else if (hour >= 6 && hour < 7) {
      met = randFloat(1.0, 2.0); // waking up
    } else if (hour >= 7 && hour < 8) {
      met = randFloat(1.5, 3.0); // morning routine
    } else if (hour >= 8 && hour < 12) {
      met = randFloat(1.2, 3.5); // morning
      if (rand() < 0.05) met = randFloat(4.0, 8.0); // occasional burst
    } else if (hour >= 12 && hour < 13) {
      met = randFloat(1.0, 2.0); // lunch
    } else if (hour >= 13 && hour < 16) {
      met = randFloat(1.2, 3.0); // afternoon
    } else if (hour >= 16 && hour < 17.5) {
      // Possible workout window
      if (rand() < 0.35) {
        met = randFloat(5.0, 12.0); // workout
      } else {
        met = randFloat(1.5, 3.5);
      }
    } else if (hour >= 17.5 && hour < 20) {
      met = randFloat(1.5, 3.0); // evening
    } else if (hour >= 20 && hour < 22) {
      met = randFloat(1.0, 1.8); // winding down
    } else {
      met = randFloat(0.8, 1.2); // sleeping
    }

    met_items.push(parseFloat(met.toFixed(1)));
  }

  // class_5min: simplified activity classes (0=non-wear, 1=rest, 2=inactive, 3=low, 4=med, 5=high)
  const class_5min = met_items.map(m => {
    if (m < 1.0) return 1;
    if (m < 1.5) return 2;
    if (m < 3.0) return 3;
    if (m < 6.0) return 4;
    return 5;
  }).join('|');

  // --- Stress data ---
  const stressHigh = randInt(20, 180);
  const recoveryHigh = randInt(60, 300);
  const daySummary = stressHigh > 120 ? 'stressful' : stressHigh < 60 ? 'restored' : 'normal';

  return {
    date,
    source: 'sample',
    sleep: {
      duration_hours: durationHours,
      efficiency,
      deep_min: deepMin,
      rem_min: remMin,
      light_min: lightMin,
      awake_min: awakeMin,
      readiness_score: readinessScore,
      phases_5min,
      bedtime_start,
      bedtime_end: bedtime_end_str,
    },
    heart: {
      resting_hr: restingHr,
      hrv_avg: hrvAvg,
      hr_min: hrMin,
      hr_max: hrMax,
      samples,
    },
    workout: {
      activity_score: activityScore,
      calories_active: caloriesActive,
      steps,
      active_min: activeMin,
      class_5min,
      met_items,
      met_timestamp,
    },
    stress: {
      stress_high: stressHigh,
      recovery_high: recoveryHigh,
      day_summary: daySummary,
    },
  };
}

// Generate last 31 days ending yesterday (relative to Feb 12, 2026)
const days = [];
const today = new Date(2026, 1, 12); // Feb 12, 2026
for (let i = 31; i >= 1; i--) {
  const d = new Date(today);
  d.setDate(d.getDate() - i);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  days.push(generateDay(date));
}

const outPath = new URL('../public/data/sample-data.json', import.meta.url).pathname;
// On Windows the pathname starts with /C:/ — normalize it
const normalizedPath = outPath.replace(/^\/([A-Z]:)/, '$1');
writeFileSync(normalizedPath, JSON.stringify(days, null, 2));
console.log(`Generated ${days.length} days → ${normalizedPath}`);
