'use client';

interface Stat {
  value: string;
  label: string;
}

interface StatsRowProps {
  stats: Stat[];
  colorClass: 'sleep' | 'heart' | 'workout' | 'stress';
  emptyMessage?: string;
}

export default function StatsRow({ stats, colorClass, emptyMessage }: StatsRowProps) {
  if (stats.length === 0 && emptyMessage) {
    return (
      <div className="stats-row">
        <p style={{ color: 'var(--text-muted)' }}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="stats-row">
      {stats.map(s => (
        <div key={s.label} className="stat-card">
          <div className={`stat-value ${colorClass}`}>{s.value}</div>
          <div className="stat-label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
