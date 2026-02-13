'use client';

import UserMenu from './UserMenu';

export type DashboardTab = 'data' | 'goals' | 'art';

interface DashboardHeaderProps {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onSettingsToggle: () => void;
  year: number;
  month: number;
  selectedDay: number | null;
  onDateChange: (year: number, month: number, day: number) => void;
  activeTab?: DashboardTab;
  onTabChange?: (tab: DashboardTab) => void;
}

export default function DashboardHeader({
  label,
  onPrev,
  onNext,
  onSettingsToggle,
  year,
  month,
  selectedDay,
  onDateChange,
  activeTab = 'data',
  onTabChange,
}: DashboardHeaderProps) {
  const dateValue = selectedDay
    ? `${year}-${String(month).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    : '';

  const handleDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    const [y, m, d] = val.split('-').map(Number);
    onDateChange(y, m, d);
  };

  const handleToday = () => {
    const now = new Date();
    onDateChange(now.getFullYear(), now.getMonth() + 1, now.getDate());
  };

  return (
    <header className="dash-header">
      <h1 className="logo">Voyage Analytics</h1>

      <div className="header-center">
        <div className="month-nav">
          <button className="icon-btn" aria-label="Previous month" onClick={onPrev}>&larr;</button>
          <span className="month-label">{label}</span>
          <button className="icon-btn" aria-label="Next month" onClick={onNext}>&rarr;</button>
        </div>
        <div className="header-date-picker">
          <input
            type="date"
            className="day-picker-input"
            value={dateValue}
            onChange={handleDateInput}
          />
          <button className="btn btn-secondary header-today-btn" onClick={handleToday}>
            Today
          </button>
        </div>
      </div>

      <div className="header-actions">
        {onTabChange && (
          <div className="dash-tab-toggle">
            {(['data', 'goals', 'art'] as DashboardTab[]).map(tab => (
              <span
                key={tab}
                className={`dash-tab-option ${activeTab === tab ? 'active' : ''}`}
                onClick={() => onTabChange(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </span>
            ))}
          </div>
        )}
        <button className="icon-btn" aria-label="Settings" onClick={onSettingsToggle}>&#9881;</button>
        <UserMenu />
      </div>
    </header>
  );
}
