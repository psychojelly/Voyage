import 'next-auth';
import 'next-auth/jwt';

export type UserRole = 'user' | 'artist' | 'admin';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: UserRole;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: UserRole;
  }
}

export interface SleepData {
  duration_hours: number;
  efficiency: number;
  deep_min: number;
  rem_min: number;
  light_min: number;
  awake_min: number;
  readiness_score: number;
  phases_5min?: string;
  bedtime_start?: string;
  bedtime_end?: string;
}

export interface HeartData {
  resting_hr: number;
  hrv_avg: number;
  hr_min: number;
  hr_max: number;
  samples?: { ts: string; bpm: number }[];
}

export interface WorkoutData {
  activity_score: number;
  calories_active: number;
  steps: number;
  active_min: number;
  class_5min?: string;
  met_items?: number[];
  met_timestamp?: string;
}

export interface StressData {
  stress_high: number;      // minutes of high stress
  recovery_high: number;    // minutes of high recovery
  day_summary: string;      // "restored" | "normal" | "stressful"
}

// ── Weather data types ────────────────────────────

export interface WeatherDay {
  date: string;
  temperature_max: number | null;
  temperature_min: number | null;
  precipitation_sum: number | null;
  rain_sum: number | null;
  windspeed_max: number | null;
  uv_index_max: number | null;
  humidity_mean: number | null;
  pollen_tree: number | null;
  pollen_grass: number | null;
  pollen_weed: number | null;
  pollen_alder: number | null;
  pollen_birch: number | null;
  pollen_olive: number | null;
  pollen_mugwort: number | null;
  pollen_ragweed: number | null;
}

export interface WeatherHourly {
  time: string[];
  temperature_2m: (number | null)[];
  relative_humidity_2m: (number | null)[];
  precipitation: (number | null)[];
  windspeed_10m: (number | null)[];
  uv_index: (number | null)[];
}

export type EventCategory = 'activity' | 'sleep' | 'health-note' | 'custom' | 'experience';

export interface HealthEvent {
  id: string;
  time: string;             // "HH:MM" (24h format)
  title: string;
  category: EventCategory;
  description?: string;
  color?: string;           // hex override (default from category)
  isAuto?: boolean;         // true = auto-detected, not stored in DB
  endTime?: string;         // "HH:MM" (24h format)
  durationMin?: number;     // duration in minutes
  room?: string;            // room identifier for experience events
}

export interface DayRecord {
  date: string;
  source?: string;
  sleep?: SleepData;
  heart?: HeartData;
  workout?: WorkoutData;
  stress?: StressData;
  events?: HealthEvent[];
}

export type GoalPeriod = 'daily' | 'weekly' | 'monthly';

export interface HealthGoal {
  metric: string;           // e.g. 'sleep_hours', 'steps', 'hrv_avg'
  label: string;
  target: number;
  unit: string;
  period: GoalPeriod;
}

// ── Installation system types ────────────────────────────

export type DataScope = 'sleep' | 'heart' | 'workout' | 'stress';

export interface Installation {
  id: string;
  artistId: string;
  name: string;
  room: string;
  apiKey: string;
  dataScopes: DataScope[];
  active: boolean;
  timeoutMin: number;
  activeSessions?: number;
}

export interface InstallationPublic {
  id: string;
  name: string;
  room: string;
  artistName?: string;
}

export type DeviceTokenType = 'nfc' | 'rfid' | 'ble' | 'other';

export interface DeviceToken {
  id: string;
  userId?: string | null;
  identifierHash: string;
  label?: string | null;
  type: DeviceTokenType;
  createdAt: string;
}

export interface PairingResult {
  pairingCode: string;
  expiresAt: string;
}

export interface Settings {
  bgEffect?: string;
  ouraClientId?: string;
  corsProxy?: string;
  ouraToken?: string;
  oauthState?: string;
  allowAdmin?: boolean;
  allowArtist?: boolean;
  goals?: HealthGoal[];
  weatherLat?: number;
  weatherLon?: number;
  weatherCity?: string;
  [key: string]: unknown;
}
