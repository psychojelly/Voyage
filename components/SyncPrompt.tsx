'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getAllDates, getMonthData } from '@/lib/store';
import { cloudSyncFromLocal } from '@/lib/store-cloud';
import type { DayRecord } from '@/lib/types';

export default function SyncPrompt() {
  const { data: session } = useSession();
  const [localCount, setLocalCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!session?.user) return;
    // Check for local data
    const dates = getAllDates();
    if (dates.length > 0) {
      setLocalCount(dates.length);
      setVisible(true);
    }
  }, [session?.user]);

  if (!visible) return null;

  async function handleSync() {
    setSyncing(true);
    try {
      // Gather all local records
      const dates = getAllDates();
      const allRecords: DayRecord[] = [];
      // Load in batches by year/month
      const monthSet = new Set<string>();
      for (const date of dates) {
        const [y, m] = date.split('-');
        monthSet.add(`${y}-${m}`);
      }
      for (const ym of monthSet) {
        const [y, m] = ym.split('-').map(Number);
        allRecords.push(...getMonthData(y, m));
      }

      const result = await cloudSyncFromLocal(allRecords);
      setDone(true);
      setLocalCount(result.synced);
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  }

  if (done) {
    return (
      <div className="sync-prompt sync-done">
        <span>Synced {localCount} days to your account!</span>
        <button className="btn btn-secondary sync-dismiss" onClick={() => setVisible(false)}>
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="sync-prompt">
      <span>Found {localCount} days of local data. Sync to your account?</span>
      <button
        className="btn btn-primary sync-btn"
        onClick={handleSync}
        disabled={syncing}
      >
        {syncing ? 'Syncing...' : 'Sync to Cloud'}
      </button>
      <button className="btn btn-secondary sync-dismiss" onClick={() => setVisible(false)}>
        Skip
      </button>
    </div>
  );
}
