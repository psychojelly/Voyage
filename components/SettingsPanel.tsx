'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import type { Settings, UserRole } from '@/lib/types';
import { normalizeJson, normalizeCsv, parseCsvString } from '@/lib/data-adapter';
import { useStore } from '@/lib/store-provider';
import InstallationManager from './InstallationManager';
import DeviceManager from './DeviceManager';
import AuditLog from './AuditLog';

function useOrigin() {
  const [origin, setOrigin] = useState('');
  useEffect(() => { setOrigin(window.location.origin); }, []);
  return origin;
}

interface GcalCalendar {
  id: string;
  summary: string;
  backgroundColor?: string;
}

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onUpdateSettings: (patch: Partial<Settings>) => Promise<void> | void;
  bgEffect: string;
  onBgEffectChange: (effect: string) => void;
  onClearData: () => void;
  onDataImported: () => void;
  debugData: boolean;
  onDebugDataToggle: (enabled: boolean) => void;
  isOuraConnected: boolean;
  ouraStatus: { text: string; type: string };
  onOuraConnect: () => void;
  onOuraDisconnect: () => void;
  onOuraFetch: (startDate: string, endDate: string) => void;
  // Google Calendar
  isGcalConnected: boolean;
  gcalStatus: { text: string; type: string };
  gcalCalendars: GcalCalendar[];
  gcalSelectedIds: string[];
  onGcalSaveSelection: (ids: string[]) => void;
  onGcalSelectedIdsChange: (ids: string[]) => void;
}

export default function SettingsPanel({
  open,
  onClose,
  settings,
  onUpdateSettings,
  bgEffect,
  onBgEffectChange,
  onClearData,
  onDataImported,
  debugData,
  onDebugDataToggle,
  isOuraConnected,
  ouraStatus,
  onOuraConnect,
  onOuraDisconnect,
  onOuraFetch,
  isGcalConnected,
  gcalStatus,
  gcalCalendars,
  gcalSelectedIds,
  onGcalSaveSelection,
  onGcalSelectedIdsChange,
}: SettingsPanelProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [importStatus, setImportStatus] = useState<{ text: string; type: string }>({ text: '', type: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const origin = useOrigin();
  const { data: session } = useSession();
  const store = useStore();

  // Share key state
  const [shareKey, setShareKey] = useState<string | null>(null);
  const [shareScopes, setShareScopes] = useState<string[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Delete account state
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteExpanded, setDeleteExpanded] = useState(false);

  useEffect(() => {
    if (!startDate || !endDate) {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      setStartDate(formatDate(start));
      setEndDate(formatDate(end));
    }
  }, [startDate, endDate]);

  // Load share key when panel opens + user is signed in
  useEffect(() => {
    if (!open || !session?.user) return;
    fetch('/api/health/share')
      .then(r => r.json())
      .then(data => {
        setShareKey(data.shareKey ?? null);
        setShareScopes(data.shareScopes ?? []);
      })
      .catch(() => {});
  }, [open, session?.user]);

  const handleGenerateKey = async () => {
    setShareLoading(true);
    try {
      const res = await fetch('/api/health/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopes: shareScopes.length > 0 ? shareScopes : ['sleep', 'heart', 'workout', 'stress'] }),
      });
      const data = await res.json();
      setShareKey(data.shareKey);
      setShareScopes(data.shareScopes);
    } finally {
      setShareLoading(false);
    }
  };

  const handleUpdateScopes = async () => {
    setShareLoading(true);
    try {
      const res = await fetch('/api/health/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopes: shareScopes }),
      });
      const data = await res.json();
      setShareKey(data.shareKey);
      setShareScopes(data.shareScopes);
    } finally {
      setShareLoading(false);
    }
  };

  const handleRevokeKey = async () => {
    if (!confirm('Revoke your share key? Anyone using it will lose access.')) return;
    setShareLoading(true);
    try {
      await fetch('/api/health/share', { method: 'DELETE' });
      setShareKey(null);
      setShareScopes([]);
    } finally {
      setShareLoading(false);
    }
  };

  const handleCopyShareUrl = () => {
    if (!shareKey || !origin) return;
    const url = `${origin}/api/public/health?key=${shareKey}`;
    navigator.clipboard.writeText(url);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const toggleScope = (scope: string) => {
    setShareScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  };

  const handleFiles = useCallback(async (fileList: FileList) => {
    if (!fileList || fileList.length === 0) return;

    let totalImported = 0;
    let errors = 0;

    for (const file of Array.from(fileList)) {
      try {
        const text = await readFile(file);
        const days = parseFileContent(file.name, text);
        const result = store.saveDays(days);
        if (result instanceof Promise) await result;
        totalImported += days.length;
      } catch (err) {
        console.error(`Error importing ${file.name}:`, err);
        errors++;
      }
    }

    if (totalImported > 0) {
      setImportStatus({
        text: `Imported ${totalImported} days of data${errors > 0 ? ` (${errors} file(s) failed)` : ''}`,
        type: 'success',
      });
      onDataImported();
    } else {
      setImportStatus({
        text: errors > 0 ? 'Failed to import files. Check format.' : 'No data found in files.',
        type: 'error',
      });
    }
  }, [onDataImported]);

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE MY ACCOUNT') {
      setDeleteError('Please type "DELETE MY ACCOUNT" exactly to confirm.');
      return;
    }
    setDeleteError('');
    setDeleteLoading(true);

    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmation: deleteConfirmation,
          ...(deletePassword ? { password: deletePassword } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setDeleteError(data.error || 'Failed to delete account.');
        setDeleteLoading(false);
        return;
      }

      // Account deleted — sign out and redirect
      await signOut({ callbackUrl: '/login' });
    } catch {
      setDeleteError('Something went wrong. Please try again.');
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <div className={`settings-overlay${open ? ' active' : ''}`} onClick={onClose} />
      <div className={`settings-panel${open ? ' open' : ''}`}>
        <div className="settings-header">
          <h2>Settings</h2>
          <span className="version-label">v0.7.0</span>
          <button className="icon-btn" aria-label="Close settings" onClick={onClose}>&times;</button>
        </div>
        <div className="settings-body">
          {/* Account */}
          <div className="setting-group">
            <h3>Account</h3>
            {session?.user ? (
              <div className="account-info">
                <div className="account-detail">
                  <span className="account-label">Signed in as</span>
                  <span className="account-value">{session.user.email}</span>
                </div>
                {session.user.name && (
                  <div className="account-detail">
                    <span className="account-label">Name</span>
                    <span className="account-value">{session.user.name}</span>
                  </div>
                )}
                <div className="account-detail">
                  <span className="account-label">Storage</span>
                  <span className="account-value account-cloud">Cloud (synced)</span>
                </div>
              </div>
            ) : (
              <div className="account-info">
                <p className="setting-hint">
                  Sign in to sync your data across devices and keep a cloud backup.
                </p>
                <div className="account-detail">
                  <span className="account-label">Storage</span>
                  <span className="account-value">Local (this browser only)</span>
                </div>
                <a href="/login" className="btn btn-primary" style={{ marginTop: 12, textDecoration: 'none', textAlign: 'center' }}>
                  Sign In / Create Account
                </a>
              </div>
            )}
          </div>

          {/* Data Access Consent (signed-in users only) */}
          {session?.user && (
            <div className="setting-group">
              <h3>Data Access Consent</h3>
              <p className="setting-hint">
                Control who can access your health data. Changes take effect immediately and can be revoked at any time.
              </p>

              <div className="consent-card">
                <label className="consent-toggle">
                  <input
                    type="checkbox"
                    checked={!!settings.allowAdmin}
                    onChange={e => onUpdateSettings({ allowAdmin: e.target.checked })}
                  />
                  Allow Admin Access
                </label>
                <div className="consent-details">
                  <p><strong>What is shared:</strong> sleep, heart rate, workout, and stress data</p>
                  <p><strong>Who can see it:</strong> the site administrator</p>
                  <p><strong>Identification:</strong> your name and email are visible to the admin</p>
                </div>
              </div>

              <div className="consent-card">
                <label className="consent-toggle">
                  <input
                    type="checkbox"
                    checked={!!settings.allowArtist}
                    onChange={e => onUpdateSettings({ allowArtist: e.target.checked })}
                  />
                  Allow Artist Access
                </label>
                <div className="consent-details">
                  <p><strong>What is shared:</strong> only the data scopes configured per installation (e.g., heart rate only)</p>
                  <p><strong>Who can see it:</strong> artists running installations you check in to</p>
                  <p><strong>Identification:</strong> fully anonymous &mdash; artists see &ldquo;Participant A&rdquo;, never your name or email</p>
                  <p><strong>Duration:</strong> only while you are checked in (sessions auto-expire)</p>
                </div>
              </div>
            </div>
          )}

          {/* Activity Log (signed-in users only) */}
          {session?.user && (
            <div className="setting-group">
              <h3>Activity Log</h3>
              <p className="setting-hint">
                A record of who accessed your data, consent changes, logins, and installation activity.
              </p>
              <AuditLog />
            </div>
          )}

          {/* Linked Devices (signed-in users) */}
          {session?.user && (
            <div className="setting-group">
              <h3>Linked Devices</h3>
              <p className="setting-hint">
                Link your phone, watch, or RFID wristband to check in at installations automatically.
              </p>
              <DeviceManager />
            </div>
          )}

          {/* Installations (artist/admin only) */}
          {session?.user && ((session.user as { role?: UserRole }).role === 'artist' || (session.user as { role?: UserRole }).role === 'admin') && (
            <div className="setting-group">
              <h3>Installations</h3>
              <p className="setting-hint">
                Create and manage art installations. Each installation gets an API key for hardware and a check-in URL for participants.
              </p>
              <InstallationManager />
            </div>
          )}

          {/* Import Data */}
          <div className="setting-group">
            <h3>Import Data</h3>
            <div
              className="drop-zone"
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
              onDragLeave={e => { e.currentTarget.classList.remove('drag-over'); }}
              onDrop={e => {
                e.preventDefault();
                e.currentTarget.classList.remove('drag-over');
                handleFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <p>Drag &amp; drop JSON or CSV files</p>
              <span className="drop-zone-hint">or</span>
              <label className="btn btn-secondary file-label" onClick={e => e.stopPropagation()}>
                Browse Files
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv"
                  multiple
                  hidden
                  onChange={e => {
                    if (e.target.files) handleFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            {importStatus.text && (
              <div className={`status-msg ${importStatus.type}`}>{importStatus.text}</div>
            )}
          </div>

          {/* Data Sharing (authenticated users only) */}
          {session?.user && (
            <div className="setting-group">
              <h3>Data Sharing</h3>
              <p className="setting-hint">
                Generate an anonymous share key to let external apps read your health data without logging in.
              </p>

              {shareKey ? (
                <>
                  <div className="share-key-url">
                    <input
                      type="text"
                      readOnly
                      value={`${origin}/api/public/health?key=${shareKey}`}
                    />
                    <button className="btn btn-secondary" onClick={handleCopyShareUrl}>
                      {shareCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>

                  <div className="share-scopes">
                    {['sleep', 'heart', 'workout', 'stress'].map(scope => (
                      <label key={scope}>
                        <input
                          type="checkbox"
                          checked={shareScopes.includes(scope)}
                          onChange={() => toggleScope(scope)}
                        />
                        {scope.charAt(0).toUpperCase() + scope.slice(1)}
                      </label>
                    ))}
                  </div>

                  <button
                    className="btn btn-primary"
                    onClick={handleUpdateScopes}
                    disabled={shareLoading}
                    style={{ marginTop: 12 }}
                  >
                    Update Scopes
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={handleRevokeKey}
                    disabled={shareLoading}
                    style={{ marginTop: 8 }}
                  >
                    Revoke Key
                  </button>
                </>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={handleGenerateKey}
                  disabled={shareLoading}
                >
                  Generate Share Key
                </button>
              )}
            </div>
          )}

          {/* Oura Ring */}
          <div className="setting-group">
            <h3>Oura Ring</h3>
            <p className="setting-hint">
              Requires an{' '}
              <a href="https://cloud.ouraring.com/oauth/applications" target="_blank" rel="noopener noreferrer">
                Oura developer app
              </a>{' '}
              and active Oura Membership. Configure your app&apos;s redirect URL to{' '}
              <code>{origin ? `${origin}/api/oura/callback` : '/api/oura/callback'}</code>
            </p>

            {isOuraConnected ? (
              <>
                <div className="connected-badge">
                  <span className="connected-dot" />
                  <span>Connected to Oura</span>
                </div>
                <div className="setting-row">
                  <label>Date Range</label>
                  <div className="date-range">
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    <span>to</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                  </div>
                </div>
                <button className="btn btn-primary" onClick={() => onOuraFetch(startDate, endDate)}>
                  Fetch Data
                </button>
                <button className="btn btn-danger" onClick={onOuraDisconnect}>
                  Disconnect
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={onOuraConnect}>
                Connect Oura Ring
              </button>
            )}

            {ouraStatus.text && (
              <div className={`status-msg ${ouraStatus.type}`}>{ouraStatus.text}</div>
            )}
          </div>

          {/* Google Calendar (shows when signed in via Google) */}
          {session?.user && isGcalConnected && (
            <div className="setting-group">
              <h3>Google Calendar</h3>
              <p className="setting-hint">
                Your Google sign-in includes calendar access. Select which calendars to show as markers on the 24-Hour View.
              </p>

              <div className="connected-badge">
                <span className="connected-dot" />
                <span>Connected via Google sign-in</span>
              </div>

              {gcalCalendars.length > 0 && (
                <div className="gcal-picker">
                  <label className="gcal-picker-label">Select calendars to display:</label>
                  <div className="gcal-calendar-list">
                    {gcalCalendars.map(cal => (
                      <label key={cal.id} className="gcal-calendar-item">
                        <input
                          type="checkbox"
                          checked={gcalSelectedIds.includes(cal.id)}
                          onChange={() => {
                            const next = gcalSelectedIds.includes(cal.id)
                              ? gcalSelectedIds.filter(id => id !== cal.id)
                              : [...gcalSelectedIds, cal.id];
                            onGcalSelectedIdsChange(next);
                          }}
                        />
                        {cal.backgroundColor && (
                          <span className="gcal-color-dot" style={{ background: cal.backgroundColor }} />
                        )}
                        <span>{cal.summary}</span>
                      </label>
                    ))}
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => onGcalSaveSelection(gcalSelectedIds)}
                    style={{ marginTop: 8 }}
                  >
                    Save Selection
                  </button>
                </div>
              )}

              {gcalStatus.text && (
                <div className={`status-msg ${gcalStatus.type}`}>{gcalStatus.text}</div>
              )}
            </div>
          )}

          {/* 3D Background */}
          <div className="setting-group">
            <h3>3D Background</h3>
            <label>Effect</label>
            <select value={bgEffect} onChange={e => onBgEffectChange(e.target.value)}>
              <option value="particles">Particle Field</option>
              <option value="waves">Wave Surface</option>
              <option value="none">None</option>
            </select>
          </div>

          {/* Weather Location */}
          <div className="setting-group">
            <h3>Weather Location</h3>
            <p className="setting-hint">
              Set your location for weather data on the External Stats page.
              Leave blank to auto-detect from your browser.
            </p>
            <label>Latitude</label>
            <input
              type="number"
              step="0.01"
              value={settings.weatherLat ?? ''}
              onChange={e => {
                const val = e.target.value;
                onUpdateSettings({ weatherLat: val ? parseFloat(val) : undefined });
              }}
              placeholder="Auto-detect"
            />
            <label>Longitude</label>
            <input
              type="number"
              step="0.01"
              value={settings.weatherLon ?? ''}
              onChange={e => {
                const val = e.target.value;
                onUpdateSettings({ weatherLon: val ? parseFloat(val) : undefined });
              }}
              placeholder="Auto-detect"
            />
            <label>City / Label</label>
            <input
              type="text"
              value={settings.weatherCity ?? ''}
              onChange={e => onUpdateSettings({ weatherCity: e.target.value || undefined })}
              placeholder="e.g. New York, NY"
            />
          </div>

          {/* Debug Data */}
          {!session?.user && (
            <div className="setting-group">
              <h3>Debug Data</h3>
              <label className="debug-data-toggle">
                <input
                  type="checkbox"
                  checked={debugData}
                  onChange={e => onDebugDataToggle(e.target.checked)}
                />
                Show placeholder data
              </label>
              <p className="setting-hint">
                Load sample data to preview the dashboard. Turn off to clear placeholder records.
              </p>
            </div>
          )}

          {/* Delete Account (signed-in users only) */}
          {session?.user && (
            <div className="setting-group">
              <h3>Delete Account</h3>
              {!deleteExpanded ? (
                <button
                  className="btn btn-danger"
                  onClick={() => setDeleteExpanded(true)}
                >
                  Delete My Account
                </button>
              ) : (
                <div className="delete-account-form">
                  <p className="setting-hint" style={{ color: 'var(--accent-danger)' }}>
                    This will permanently delete your account and all associated data
                    (health records, devices, installations, sessions). This action cannot be undone.
                  </p>
                  <label>
                    Password
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={e => setDeletePassword(e.target.value)}
                      placeholder="Enter your password to confirm"
                      autoComplete="current-password"
                    />
                  </label>
                  <label>
                    Type <strong>DELETE MY ACCOUNT</strong> to confirm
                    <input
                      type="text"
                      value={deleteConfirmation}
                      onChange={e => setDeleteConfirmation(e.target.value)}
                      placeholder="DELETE MY ACCOUNT"
                      autoComplete="off"
                    />
                  </label>
                  {deleteError && <div className="auth-error">{deleteError}</div>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button
                      className="btn btn-danger"
                      onClick={handleDeleteAccount}
                      disabled={deleteLoading || deleteConfirmation !== 'DELETE MY ACCOUNT'}
                    >
                      {deleteLoading ? 'Deleting...' : 'Permanently Delete'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setDeleteExpanded(false);
                        setDeleteConfirmation('');
                        setDeletePassword('');
                        setDeleteError('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Clear Data */}
          <div className="setting-group">
            <button className="btn btn-danger" onClick={() => {
              if (confirm('Are you sure you want to clear all health data?')) {
                onClearData();
              }
            }}>
              Clear All Data
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function parseFileContent(filename: string, text: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'json') return normalizeJson(JSON.parse(text));
  if (ext === 'csv') return normalizeCsv(parseCsvString(text));
  throw new Error(`Unsupported file type: .${ext}`);
}
