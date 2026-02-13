'use client';

import { createContext, useContext, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import type { DayRecord, Settings } from './types';

import * as local from './store';
import * as cloud from './store-cloud';

export type StoreMode = 'local' | 'cloud';

export interface StoreApi {
  mode: StoreMode;
  saveDay: (day: DayRecord) => void | Promise<void>;
  saveDays: (days: DayRecord[]) => void | Promise<void>;
  getMonthData: (year: number, month: number) => DayRecord[] | Promise<DayRecord[]>;
  getDateRange: (start: string, end: string) => DayRecord[] | Promise<DayRecord[]>;
  getAllDates: () => string[] | Promise<string[]>;
  clearAllData: () => void | Promise<void>;
  loadSettings: () => Settings | Promise<Settings>;
  saveSettings: (patch: Partial<Settings>) => void | Promise<void>;
}

const StoreContext = createContext<StoreApi | null>(null);

const localStore: StoreApi = {
  mode: 'local',
  saveDay: local.saveDay,
  saveDays: local.saveDays,
  getMonthData: local.getMonthData,
  getDateRange: local.loadRange,
  getAllDates: local.getAllDates,
  clearAllData: local.clearAllData,
  loadSettings: local.loadSettings,
  saveSettings: local.saveSettings,
};

const cloudStore: StoreApi = {
  mode: 'cloud',
  saveDay: cloud.cloudSaveDay,
  saveDays: cloud.cloudSaveDays,
  getMonthData: cloud.cloudGetMonthData,
  getDateRange: cloud.cloudGetDateRange,
  getAllDates: cloud.cloudGetAllDates,
  clearAllData: cloud.cloudClearAllData,
  loadSettings: cloud.cloudLoadSettings,
  saveSettings: cloud.cloudSaveSettings,
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const store = useMemo<StoreApi>(
    () => (session?.user ? cloudStore : localStore),
    [session?.user],
  );

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

export function useStoreMode(): StoreMode {
  return useStore().mode;
}
