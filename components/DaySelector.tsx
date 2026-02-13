'use client';

interface DaySelectorProps {
  year: number;
  month: number;
  selectedDay: number | null;
  onChange: (day: number) => void;
  onDateChange: (year: number, month: number, day: number) => void;
}

export default function DaySelector({ year, month, selectedDay, onDateChange }: DaySelectorProps) {
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
    <div className="day-picker">
      <div className="day-picker-date-row">
        <input
          type="date"
          className="day-picker-input"
          value={dateValue}
          onChange={handleDateInput}
        />
        <button className="btn btn-secondary day-picker-today" onClick={handleToday}>
          Today
        </button>
      </div>
    </div>
  );
}
