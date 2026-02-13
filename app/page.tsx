'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useStore } from '@/lib/store-provider';
import { useMonthData } from '@/hooks/useMonthData';
import { useSettings } from '@/hooks/useSettings';
import { useOuraConnection } from '@/hooks/useOuraConnection';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import DashboardHeader from '@/components/DashboardHeader';
import type { DashboardTab } from '@/components/DashboardHeader';
import Sidebar from '@/components/Sidebar';
import GoalsPanel from '@/components/GoalsPanel';
import ArtView from '@/components/ArtView';
import SettingsPanel from '@/components/SettingsPanel';
import DayDetail from '@/components/DayDetail';
import SleepCharts from '@/components/charts/SleepCharts';
import HeartCharts from '@/components/charts/HeartCharts';
import StressCharts from '@/components/charts/StressCharts';
import DayIntraday from '@/components/charts/DayIntraday';
import HeartRateOverlay from '@/components/charts/HeartRateOverlay';
import ActivityOverlay from '@/components/charts/ActivityOverlay';
import SleepOverlay from '@/components/charts/SleepOverlay';
import ActivityCharts from '@/components/charts/ActivityCharts';
import SyncPrompt from '@/components/SyncPrompt';
import { clearSampleData, saveSampleDays } from '@/lib/store';
import dynamic from 'next/dynamic';
import type { DayRecord, HealthEvent, UserRole } from '@/lib/types';
import { fetchUserDateRange } from '@/lib/store-cloud';

const ThreeBackground = dynamic(() => import('@/components/three/ThreeBackground'), { ssr: false });

export default function DashboardPage() {
  const { data: session, status: sessionStatus } = useSession();
  const store = useStore();
  const monthData = useMonthData();
  const { settings, updateSettings } = useSettings();
  const oura = useOuraConnection();
  const gcal = useGoogleCalendar();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gcalEvents, setGcalEvents] = useState<HealthEvent[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [bgEffect, setBgEffect] = useState('particles');
  const [debugData, setDebugData] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const artMode = activeTab === 'art';

  // Viewer state for admin/artist
  const userRole: UserRole = (session?.user as { role?: UserRole } | undefined)?.role || 'user';
  const [viewMode, setViewMode] = useState<'user' | 'admin' | 'artist'>('admin');
  const [availableUsers, setAvailableUsers] = useState<{ id: string; label: string; name?: string; email?: string }[]>([]);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [viewingUserLabel, setViewingUserLabel] = useState<string>('');
  const [viewedData, setViewedData] = useState<DayRecord[]>([]);
  const isViewingOther = !!viewingUserId;
  const canSwitchMode = userRole === 'admin'; // admins can toggle between admin/artist view

  // Handle date picker changing to a different date
  const handleDateChange = useCallback((y: number, m: number, d: number) => {
    monthData.setFullDate(y, m, d);
  }, [monthData]);

  // Derive the focused day record from the selected focus date
  const focusDayRecord = useMemo(() => {
    const dayStr = String(monthData.day).padStart(2, '0');
    const monthStr = String(monthData.month).padStart(2, '0');
    const target = `${monthData.year}-${monthStr}-${dayStr}`;
    return monthData.data.find(d => d.date === target) ?? null;
  }, [monthData.year, monthData.month, monthData.day, monthData.data]);

  // Derive previous day record (for Sleep Effector view)
  const prevDayRecord = useMemo(() => {
    const focus = new Date(monthData.year, monthData.month - 1, monthData.day);
    focus.setDate(focus.getDate() - 1);
    const y = focus.getFullYear();
    const m = String(focus.getMonth() + 1).padStart(2, '0');
    const d = String(focus.getDate()).padStart(2, '0');
    return monthData.data.find(r => r.date === `${y}-${m}-${d}`) ?? null;
  }, [monthData.year, monthData.month, monthData.day, monthData.data]);

  // Focus date as YYYY-MM-DD string for gcal event fetching
  const focusDateStr = useMemo(() => {
    const dayStr = String(monthData.day).padStart(2, '0');
    const monthStr = String(monthData.month).padStart(2, '0');
    return `${monthData.year}-${monthStr}-${dayStr}`;
  }, [monthData.year, monthData.month, monthData.day]);

  // Fetch Google Calendar events when focus date changes
  useEffect(() => {
    if (!gcal.isConnected) {
      setGcalEvents([]);
      return;
    }
    gcal.fetchEvents(focusDateStr).then(setGcalEvents);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusDateStr, gcal.isConnected]);

  // Sync debugData state from persisted settings
  useEffect(() => {
    if (settings.debugData === false) setDebugData(false);
  }, [settings.debugData]);

  // Load sample data on first run (local mode only), then refresh
  useEffect(() => {
    if (sessionStatus === 'loading') return;

    async function init() {
      // Check persisted debugData setting (default true for first-time anon)
      const savedSettings = store.loadSettings();
      const saved = savedSettings instanceof Promise ? await savedSettings : savedSettings;
      if (saved.debugData === false) {
        setDebugData(false);
        monthData.refresh();
        return;
      }

      // For anonymous users: always clear stale sample data and reload fresh
      if (!session?.user) {
        clearSampleData();
        try {
          const res = await fetch('/data/sample-data.json');
          const sampleData: DayRecord[] = await res.json();
          saveSampleDays(sampleData);
        } catch (err) {
          console.warn('Could not load sample data:', err);
        }
      }
      monthData.refresh();
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, store]);

  // Refresh data when focus date changes (range shifts)
  useEffect(() => {
    monthData.refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthData.startStr, monthData.endStr]);

  // Load persisted bg effect
  useEffect(() => {
    if (settings.bgEffect) {
      setBgEffect(settings.bgEffect);
    }
  }, [settings.bgEffect]);

  // Check Oura connection on page load (check for callback params)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('oura_connected') === 'true') {
      oura.setIsConnected(true);
      oura.setStatus({ text: 'Connected to Oura! Click "Fetch Data" to import.', type: 'success' });
      window.history.replaceState(null, '', window.location.pathname);
    } else if (params.get('oura_error')) {
      oura.setStatus({ text: `OAuth error: ${params.get('oura_error')}`, type: 'error' });
      window.history.replaceState(null, '', window.location.pathname);
    } else {
      oura.checkConnection();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check Google Calendar connection when signed in
  useEffect(() => {
    if (!session?.user) return;
    gcal.checkConnection();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user]);

  // Fetch available users for admin/artist viewer
  // For admins: re-fetch when viewMode toggles between admin/artist
  const activeViewMode = userRole === 'admin'
    ? (viewMode === 'user' ? null : viewMode)
    : (userRole === 'artist' ? 'artist' : null);
  useEffect(() => {
    if (!session?.user || !activeViewMode) {
      setAvailableUsers([]);
      setViewingUserId(null);
      return;
    }

    const endpoint = activeViewMode === 'admin' ? '/api/admin/users' : '/api/artist/users';
    setViewingUserId(null);
    setViewedData([]);
    fetch(endpoint)
      .then(r => r.ok ? r.json() : [])
      .then((users: { id: string; label?: string; name?: string; email?: string }[]) => {
        setAvailableUsers(users.map(u => ({
          id: u.id,
          label: u.label || u.name || u.email || u.id,
          name: u.name,
          email: u.email,
        })));
      })
      .catch(() => setAvailableUsers([]));
  }, [session?.user, activeViewMode]);

  // Fetch viewed user's data when selection changes
  useEffect(() => {
    if (!viewingUserId) {
      setViewedData([]);
      return;
    }

    fetchUserDateRange(viewingUserId, monthData.startStr, monthData.endStr)
      .then(setViewedData)
      .catch(() => setViewedData([]));
  }, [viewingUserId, monthData.startStr, monthData.endStr]);

  // Compute display data: own data or viewed user's data
  const displayData = isViewingOther ? viewedData : monthData.data;
  const displayDayRecord = useMemo(() => {
    if (!isViewingOther) return focusDayRecord;
    const dayStr = String(monthData.day).padStart(2, '0');
    const monthStr = String(monthData.month).padStart(2, '0');
    const target = `${monthData.year}-${monthStr}-${dayStr}`;
    return viewedData.find(d => d.date === target) ?? null;
  }, [isViewingOther, focusDayRecord, viewedData, monthData.year, monthData.month, monthData.day]);

  const displayPrevDay = useMemo(() => {
    if (!isViewingOther) return prevDayRecord;
    const focus = new Date(monthData.year, monthData.month - 1, monthData.day);
    focus.setDate(focus.getDate() - 1);
    const y = focus.getFullYear();
    const m = String(focus.getMonth() + 1).padStart(2, '0');
    const d = String(focus.getDate()).padStart(2, '0');
    return viewedData.find(r => r.date === `${y}-${m}-${d}`) ?? null;
  }, [isViewingOther, prevDayRecord, viewedData, monthData.year, monthData.month, monthData.day]);

  const handleBgEffectChange = useCallback((effect: string) => {
    setBgEffect(effect);
    updateSettings({ bgEffect: effect });
  }, [updateSettings]);

  const handleClearData = useCallback(async () => {
    const result = store.clearAllData();
    if (result instanceof Promise) await result;
    monthData.refresh();
  }, [store, monthData]);

  const handleDataImported = useCallback(() => {
    monthData.refresh();
  }, [monthData]);

  const handleDebugDataToggle = useCallback(async (enabled: boolean) => {
    setDebugData(enabled);
    updateSettings({ debugData: enabled });

    if (!enabled) {
      clearSampleData();
    } else {
      try {
        const res = await fetch('/data/sample-data.json');
        const sampleData: DayRecord[] = await res.json();
        saveSampleDays(sampleData);
      } catch (err) {
        console.warn('Could not load sample data:', err);
      }
    }
    monthData.refresh();
  }, [monthData, updateSettings]);

  return (
    <>
      <ThreeBackground effect={bgEffect} data={displayData} artMode={artMode} />

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        bgEffect={bgEffect}
        onBgEffectChange={handleBgEffectChange}
        onClearData={handleClearData}
        debugData={debugData}
        onDebugDataToggle={handleDebugDataToggle}
        isOuraConnected={oura.isConnected}
        ouraStatus={oura.status}
        onOuraConnect={oura.startOAuth}
        onOuraDisconnect={oura.disconnect}
        onOuraFetch={(start, end) => oura.fetchData(start, end, handleDataImported)}
        onDataImported={handleDataImported}
        isGcalConnected={gcal.isConnected}
        gcalStatus={gcal.status}
        gcalCalendars={gcal.calendars}
        gcalSelectedIds={gcal.selectedIds}
        onGcalSaveSelection={gcal.saveSelection}
        onGcalSelectedIdsChange={gcal.setSelectedIds}
      />

      <div className={`app-layout${artMode ? ' art-mode' : ''}`}>
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="main-content">
          <DashboardHeader
            label={monthData.label}
            onPrev={monthData.prevMonth}
            onNext={monthData.nextMonth}
            onSettingsToggle={() => setSettingsOpen(o => !o)}
            year={monthData.year}
            month={monthData.month}
            selectedDay={monthData.day}
            onDateChange={handleDateChange}
          />

          {/* Viewer selector for admin/artist (shared between overview & internal) */}
          {(activeTab === 'overview' || activeTab === 'internal') && (userRole === 'admin' || userRole === 'artist') && (
            <div className="viewer-selector-bar">
              {canSwitchMode && (
                <div className="viewer-mode-toggle">
                  <button
                    className={`viewer-mode-btn ${viewMode === 'user' ? 'active' : ''}`}
                    onClick={() => setViewMode('user')}
                  >
                    User
                  </button>
                  <button
                    className={`viewer-mode-btn ${viewMode === 'admin' ? 'active' : ''}`}
                    onClick={() => setViewMode('admin')}
                  >
                    Admin
                  </button>
                  <button
                    className={`viewer-mode-btn ${viewMode === 'artist' ? 'active' : ''}`}
                    onClick={() => setViewMode('artist')}
                  >
                    Artist
                  </button>
                </div>
              )}
              {activeViewMode && (
                <>
                  <span className="viewer-label">Viewing:</span>
                  <select
                    className="viewer-select"
                    value={viewingUserId || ''}
                    onChange={e => {
                      const id = e.target.value || null;
                      setViewingUserId(id);
                      const user = availableUsers.find(u => u.id === id);
                      setViewingUserLabel(user?.label || '');
                    }}
                  >
                    <option value="">My Data</option>
                    {availableUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.label}</option>
                    ))}
                  </select>
                  {isViewingOther && (
                    <span className="viewer-badge">{activeViewMode === 'admin' ? 'Admin View' : 'Artist View'}</span>
                  )}
                </>
              )}
            </div>
          )}

          {/* Overview: 24-Hour View + Goals */}
          {activeTab === 'overview' && (
            <>
              <SyncPrompt />
              <section className="metric-section">
                <h2 className="section-title">24-Hour View</h2>
                <DayIntraday
                  day={displayDayRecord}
                  prevDay={displayPrevDay}
                  onDayUpdated={isViewingOther ? undefined : monthData.refresh}
                  gcalEvents={isViewingOther ? [] : gcalEvents}
                  readOnly={isViewingOther}
                />
              </section>
              <GoalsPanel
                data={displayData}
                focusDay={displayDayRecord}
                focusDate={focusDateStr}
                settings={settings}
                onUpdateSettings={updateSettings}
              />
            </>
          )}

          {/* External Stats: placeholder */}
          {activeTab === 'external' && (
            <section className="metric-section placeholder-page">
              <h2 className="section-title">External Stats</h2>
              <div className="placeholder-content">
                <span className="placeholder-icon">{'\u2197'}</span>
                <p className="placeholder-text">External Stats coming soon</p>
                <p className="placeholder-subtext">
                  Environmental data, location analytics, and external health factors will appear here.
                </p>
              </div>
            </section>
          )}

          {/* Internal Stats: all chart sections */}
          {activeTab === 'internal' && (
            <>
              <SyncPrompt />
              <section className="metric-section">
                <h2 className="section-title sleep">Sleep</h2>
                <SleepCharts data={displayData} onDayClick={setSelectedDay} />
                <SleepOverlay data={displayData} />
              </section>
              <section className="metric-section">
                <h2 className="section-title heart">Heart Rate</h2>
                <HeartCharts data={displayData} onDayClick={setSelectedDay} />
                <HeartRateOverlay data={displayData} />
              </section>
              <section className="metric-section">
                <h2 className="section-title workout">Activity</h2>
                <ActivityCharts data={displayData} onDayClick={setSelectedDay} />
                <ActivityOverlay data={displayData} />
              </section>
              <section className="metric-section">
                <h2 className="section-title stress">Stress</h2>
                <StressCharts data={displayData} onDayClick={setSelectedDay} />
              </section>
            </>
          )}

          {/* Mind: placeholder */}
          {activeTab === 'mind' && (
            <section className="metric-section placeholder-page">
              <h2 className="section-title">Mind</h2>
              <div className="placeholder-content">
                <span className="placeholder-icon">{'\u2734'}</span>
                <p className="placeholder-text">Mind analytics coming soon</p>
                <p className="placeholder-subtext">
                  Meditation tracking, cognitive metrics, and mental wellness data will appear here.
                </p>
              </div>
            </section>
          )}

          {/* Art */}
          {activeTab === 'art' && (
            <ArtView data={displayData} focusDay={displayDayRecord} prevDay={displayPrevDay} />
          )}
        </div>
      </div>

      <DayDetail
        open={!artMode && !!selectedDay}
        day={displayData.find(d => d.date === selectedDay) ?? null}
        monthData={displayData}
        onClose={() => setSelectedDay(null)}
        onNavigate={setSelectedDay}
      />
    </>
  );
}
