'use client';

import { useState, useCallback, useEffect } from 'react';
import { useStore } from '@/lib/store-provider';
import type { Settings } from '@/lib/types';

export function useSettings() {
  const store = useStore();
  const [settings, setSettings] = useState<Settings>({});

  useEffect(() => {
    async function load() {
      const result = store.loadSettings();
      const resolved = result instanceof Promise ? await result : result;
      setSettings(resolved);
    }
    load();
  }, [store]);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const result = store.saveSettings(patch);
    if (result instanceof Promise) await result;
    setSettings(prev => ({ ...prev, ...patch }));
  }, [store]);

  return { settings, updateSettings };
}
