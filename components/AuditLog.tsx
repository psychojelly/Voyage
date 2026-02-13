'use client';

import { useState, useEffect, useCallback } from 'react';

interface AuditEntry {
  id: string;
  action: string;
  label: string;
  resource: string | null;
  detail: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

interface AuditResponse {
  items: AuditEntry[];
  page: number;
  total: number;
  totalPages: number;
}

const ACTION_ICONS: Record<string, string> = {
  'data.access': 'eye',
  'consent.change': 'shield',
  'session.create': 'login',
  'session.auto_checkout': 'logout',
  'auth.login': 'key',
  'auth.login_failed': 'warning',
  'account.delete': 'trash',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getIconClass(action: string): string {
  return ACTION_ICONS[action] || 'dot';
}

export default function AuditLog() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/account/audit?page=${p}&limit=20`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setPage(p);
      }
    } catch (err) {
      console.error('Failed to fetch audit log:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPage(1);
  }, [fetchPage]);

  if (loading && !data) return <p className="setting-hint">Loading activity log...</p>;

  if (!data || data.items.length === 0) {
    return <p className="setting-hint">No activity recorded yet.</p>;
  }

  return (
    <div className="audit-log">
      <div className="audit-entries">
        {data.items.map(entry => (
          <div key={entry.id} className="audit-entry">
            <span className={`audit-icon audit-icon-${getIconClass(entry.action)}`} />
            <div className="audit-entry-content">
              <span className="audit-label">{entry.label}</span>
              {entry.resource && (
                <span className="audit-resource">{entry.resource}</span>
              )}
              <span className="audit-time">{formatDate(entry.createdAt)}</span>
            </div>
            {entry.ip && entry.ip !== 'unknown' && (
              <span className="audit-ip">{entry.ip}</span>
            )}
          </div>
        ))}
      </div>

      {data.totalPages > 1 && (
        <div className="audit-pagination">
          <button
            className="btn btn-secondary btn-sm"
            disabled={page <= 1 || loading}
            onClick={() => fetchPage(page - 1)}
          >
            Previous
          </button>
          <span className="audit-page-info">
            Page {data.page} of {data.totalPages} ({data.total} entries)
          </span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page >= data.totalPages || loading}
            onClick={() => fetchPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
