'use client';

import type { DashboardTab } from './DashboardHeader';

interface SidebarProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
}

const NAV_ITEMS: { id: DashboardTab; label: string; icon: string }[] = [
  { id: 'overview',  label: 'Overview',        icon: '\u25C9' },
  { id: 'external',  label: 'External Stats',  icon: '\u2197' },
  { id: 'internal',  label: 'Internal Stats',  icon: '\u2665' },
  { id: 'mind',      label: 'Mind',            icon: '\u2734' },
  { id: 'art',       label: 'Art',             icon: '\u25C6' },
];

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <nav className="sidebar">
      <div className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`sidebar-item${activeTab === item.id ? ' active' : ''}`}
            onClick={() => onTabChange(item.id)}
            aria-label={item.label}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
